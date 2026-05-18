# Pre-launch checklist

Things to do before flipping Ultron to public/production.

---

## 1. Run the SQL migration

Open the Supabase dashboard → SQL editor and run **`apps/dashboard/supabase/migration_billing.sql`** in full (or the new sections if you have already run an earlier version).

The sections added most recently that **must** be applied before the grouped-errors view and regression tracking work:

- `check_and_increment_event_count` — atomic event-limit function (replaces racy read+check)
- `resolved_fingerprints` table + RLS policies
- `get_grouped_errors` function
- `count_grouped_errors` function

---

## 2. Remove the TestError component

`apps/dashboard/components/test-error.tsx` throws a fake error 1 second after the error-detail page loads. It exists so you can test that the SDK is capturing events.

**When you're done testing:**

1. Delete `apps/dashboard/components/test-error.tsx`
2. Remove the import from `apps/dashboard/app/dashboard/errors/[id]/page.tsx` (line 12)
3. Remove `<TestError />` from the same file (line 419)

---

## 3. Enforce invite token expiry

The invite email says the link expires in 7 days, but the code never checks this.

File: `apps/dashboard/app/invite/[token]/page.tsx` (and/or the accept API route)

What to add:
- A `expires_at` column to `project_members` (e.g. `DEFAULT now() + interval '7 days'`)
- A check when the invite is accepted: if `now() > expires_at`, return a 410 Gone / "invite expired" page

Until this is done either update the email copy to remove the "7 days" claim, or just accept that invites never expire (lower risk than a misleading email).

---

## 4. Sync schema.sql

`apps/dashboard/supabase/schema.sql` is the reference schema used for local dev / new environment setup. It is currently missing:

- `message_fingerprint` column on `errors`
- All billing columns on `profiles` (`plan`, `stripe_*`, `monthly_event_count`, `billing_cycle_start`, `weekly_ai_count`, `ai_count_reset_at`)
- `resolved_fingerprints` table
- `get_grouped_errors` function
- `count_grouped_errors` function
- `check_and_increment_event_count` function

Copy the relevant DDL from `migration_billing.sql` into `schema.sql` so the two files stay in sync.

---

## 5. Set production environment variables

Make sure every variable below is set in your Vercel (or equivalent) production environment. Missing any one of these will silently break a feature.

| Variable | Used for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin operations (cleanup cron, fix route, regression tracking) |
| `OPENAI_API_KEY` | AI fix suggestions |
| `STRIPE_SECRET_KEY` | Checkout / portal |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe.js on the client |
| `UPSTASH_REDIS_REST_URL` | Rate limiting |
| `UPSTASH_REDIS_REST_TOKEN` | Rate limiting |
| `RESEND_API_KEY` | Invite emails |
| `CRON_SECRET` | Authorises the `/api/errors/cleanup` cron hit |
| `AWS_ACCESS_KEY_ID` | Session replay S3 uploads |
| `AWS_SECRET_ACCESS_KEY` | Session replay S3 uploads |
| `AWS_REGION` | Session replay S3 uploads |
| `S3_BUCKET_NAME` | Session replay S3 uploads |

---

## 6. Wire up the cleanup cron

`/api/errors/cleanup` runs plan-aware retention (free = 30 days, pro = 90 days) but it only runs when called. Set up a daily cron to hit it:

**Vercel Cron** — add to `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/errors/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

The route already checks the `Authorization: Bearer $CRON_SECRET` header so set `CRON_SECRET` in your env and Vercel will send it automatically.

---

## 7. Configure Stripe webhook

In the Stripe dashboard register a webhook endpoint pointing at `https://your-domain.com/api/billing/webhook`.

Events to listen for (at minimum):
- `checkout.session.completed`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.

---

## 8. Test the SDK end-to-end

Before launch, verify the full ingest path works in production:

1. Install the SDK in a test app (`@ultron/tracker` or the JS snippet)
2. Trigger a real JS error and a fetch error
3. Confirm the event appears in the dashboard under the correct project
4. Resolve it and re-trigger — confirm the regression badge appears

---

## Already done (no action needed)

- Security headers on all routes (X-Frame-Options, HSTS, CSP, etc.)
- Rate limiting on billing, fix, project, and member invite routes
- Atomic event-count check (no TOCTOU race)
- `gpt-4o-mini` model name corrected in `/api/fix`
- Debug endpoint (`/api/debug/memberships`) removed — was leaking invite tokens
- DELETE `/api/fix` ownership check added
- Cached AI suggestions now bypass the weekly AI limit check
- Null / invalid-date guards on billing date helper functions
- Error grouping by fingerprint in the dashboard
- Regression badge for re-appearing resolved errors
- Onboarding empty state with SDK quick-start snippet
