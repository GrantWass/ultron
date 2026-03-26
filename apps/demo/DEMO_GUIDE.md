# Ultron Demo Recording Guide

Target length: **60–90 seconds**
Hero feature: **Session Replay**

---

## Setup (Do This Before Recording)

### 1. Add Your API Key

Create `apps/demo/.env.local`:
```
VITE_ULTRON_API_KEY=ultrn_your_real_project_key_here
```
Get your key from **ultron.live → your project → Settings → API Key**.

### 2. Build & Start

```bash
# From repo root
pnpm dev:demo
```

This builds the SDK and opens `http://localhost:5173` automatically.

> If the SDK hasn't been built yet, run `pnpm build:sdk` first.

### 3. Open the Ultron Dashboard

Open `ultron.live` in a **second window** — have it on the Errors page, ready to switch to after the checkout error hits.

### 4. Browser Setup

- **Browser**: Chrome
- **Window size**: 1280×800 or 1440×900 (not full 4K — smaller = better replay quality)
- **DevTools**: Dock to the **right side**
- Open **Console tab** → click the log level dropdown → enable **Verbose**
- Type `[DEMO]` in the Console filter box — shows only demo narration logs
- Open **Network tab** → filter by **Fetch/XHR**
- **Zoom**: 90% browser zoom so the full checkout form is visible

---

## Scene-by-Scene Script

### Scene 1 — Product Page (0:00–0:08)

*Full screen, no DevTools*

Start recording on the product page — it loads immediately looking polished.

Slowly scroll down a bit. Hover over the thumbnail images. Take 3–4 seconds just appreciating the UI.

Suggested narration:
> "This is a typical e-commerce checkout. One line of code: `initTracker()`. Ultron is already recording."

---

### Scene 2 — Add to Cart (0:08–0:18)

Click **"Add to Cart — $149"**.

The page transitions to the checkout form.

*Optional: flip open DevTools for 3 seconds to show the Network tab with two green GET requests.*

Narration:
> "Every click and scroll is buffered in a 30-second replay window."

---

### Scene 3 — Fill Checkout Form (0:18–0:32)

Type naturally — don't rush. Tab through the fields:

| Field | Value to type |
|-------|---------------|
| Full Name | `John Smith` |
| Email | `john@example.com` |
| Card Number | `4242 4242 4242 4242` |
| Expiry | `12 / 27` |
| CVV | `123` |
| Address | `123 Main St, SF, CA` |

Narration (while typing):
> "Card inputs are **masked** in the replay — Ultron never records sensitive values."

---

### Scene 4 — Place Order / Error (0:32–0:42)

Click **"Place Order — $149"**.

Watch the spinner for ~2 seconds, then the error page slides in.

*Show the Console tab briefly* — you'll see:
```
[DEMO] Payment API returned 500 — throwing payment error
[DEMO] captureError() called — error queued. Ultron will flush to dashboard in ~5s
[DEMO] Session replay snapshot will be attached to this error.
```

Narration:
> "The payment API returned a 500. That error — and everything the user just did — is now in Ultron."

---

### Scene 5 — Switch to Dashboard (0:42–0:52)

Switch to the Ultron dashboard window (already open).

**Wait a few seconds if needed** — the SDK flushes the error queue every 5 seconds. Hit refresh on the errors list if the error hasn't appeared yet.

Click into the error: **"Payment processing failed: server returned 500"**

Point out:
- The stack trace
- The **metadata panel**: `userId`, `orderId`, `cardLast4`, `amount`, `step`
- The **session recording badge** (this is the key visual)

Narration:
> "Full stack trace. Rich metadata. And look — a session replay."

---

### Scene 6 — Session Replay (0:52–1:15) ← HERO MOMENT

Click the session replay indicator / "Watch Replay" button.

Hit **Play**.

The replay shows everything in the right order:
1. Product page load
2. User scrolling and hovering thumbnails
3. Clicking "Add to Cart"
4. Form being filled — *card field shows dots, not digits*
5. "Place Order" click
6. Error state appearing

**Pause** at the moment right before the error. Point to the scrubber timeline.

Narration:
> "This is exactly what the user saw. Every interaction, perfectly reproduced. You can seek to the moment it broke."

*If the replay shows input fields with masked dots instead of the card number, point it out explicitly:*
> "Notice the card field — masked. Security by default."

---

### Scene 7 — AI Fix (1:15–1:30)

Click **"Suggest Fix with AI"** on the error detail page.

Watch the streaming response appear.

Narration:
> "GPT-4 mini gets the error, the stack trace, and your actual source files from GitHub. Root cause. Diff. Done."

---

## Showing the Network Tab (Optional Scene)

Best moment: **after the error hits**, wait 5 seconds, then switch to the Network tab.

You'll see a `POST` to `ultron.live/api/ingest`. Click it → **Preview** tab.

Show the payload:
```json
{
  "errors": [{
    "event_type": "error",
    "message": "Payment processing failed: server returned 500",
    "session_recording_id": "rec_...",
    "metadata": {
      "userId": "user_demo_42",
      "orderId": "ord_...",
      "amount": 149
    }
  }]
}
```

Point to `session_recording_id` — this is what links the error to the replay.

---

## Troubleshooting

**Error not appearing in dashboard after ~10s**
- Check `.env.local` has the right API key
- Open Network tab — look for a failed `POST ultron.live/api/ingest` (check the response)
- Make sure you're looking at the right project in the dashboard

**Session replay not attaching to the error**
- Verify `rrweb: "2.0.0-alpha.4"` in `apps/demo/package.json` matches the SDK's version
- Check Network tab for a `POST ultron.live/api/session-replay` request after the error fires
- Session replay requires a real API key with a valid project — the demo key placeholder won't work

**httpbin.org not responding (no 500 error)**
- Edit `main.js` line ~80: replace `https://httpbin.org/status/500` with `https://jsonplaceholder.typicode.com/posts/99999` — that returns 404 which also triggers the error path

**Ingest POST not visible in Network tab**
- The SDK batches and flushes every 5 seconds — wait after the error
- Alternatively, trigger the error and immediately switch tabs and back — the visibility change flushes the queue early

---

## Quick Narration Reference (30-word summary per scene)

| Scene | Narration |
|-------|-----------|
| Product page | "One initTracker() call. Ultron is already recording." |
| Add to Cart | "Every click buffered in a 30-second window." |
| Fill form | "Inputs masked in replay — card data never recorded." |
| Error hits | "500 from the payment API. Error + context captured instantly." |
| Dashboard | "Stack trace, metadata, and a session replay — all linked." |
| Replay | "Exactly what the user saw. Seek to the moment it broke." |
| AI fix | "Stack trace + source files → GPT-4 mini → diff. Done." |
