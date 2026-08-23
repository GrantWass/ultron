# Google Search Console setup for https://ultron.live

Verification is already wired up in code — no further code changes are needed.
Any `GET /google<TOKEN>.html` returns the bare string `google<TOKEN>` with
`content-type: text/plain`, where `<TOKEN>` comes from the
`GOOGLE_VERIFICATION_TOKEN` environment variable:

- `apps/dashboard/next.config.mjs` rewrites `/google<TOKEN>.html` (internal
  rewrite, no redirect) to `/api/google-verification/<token>`
- `apps/dashboard/app/api/google-verification/[token]/route.ts` returns the
  token string only when it matches `GOOGLE_VERIFICATION_TOKEN`; anything else
  gets a 404

## Remaining steps (one-time)

1. **Create the property.** Go to
   [https://search.google.com/search-console](https://search.google.com/search-console)
   and click **Add property**. Choose **URL prefix** and enter
   `https://ultron.live`.

2. **Choose the verification method.** Pick **HTML file**. Google will offer a
   download named like `google1234abcd5678ef90.html`. The token is everything
   between `google` and `.html` in that filename.

3. **Set the env var.** In Vercel (dashboard → ultron dashboard project →
   Settings → Environment Variables), add to the **Production** environment:

   ```
   GOOGLE_VERIFICATION_TOKEN=<the-token-from-step-2>
   ```

   It is documented in `apps/dashboard/.env.example`.

4. **Deploy** the dashboard (merge/redeploy) so the running app has the env var.

5. **Smoke test** before clicking Verify:

   ```sh
   curl -i https://ultron.live/google<the-token>.html
   ```

   Expect `HTTP/2 200`, `content-type: text/plain`, and a body of exactly
   `google<the-token>`.

6. **Verify.** Back in Search Console, click **Verify**. Do not remove the env
   var afterwards — Google rechecks periodically.

7. **Grant the Agent City analytics service account read access.** In Search
   Console go to **Settings → Users and permissions → Add user**, enter

   ```
   agentcity@mercurial-craft-505718-f8.iam.gserviceaccount.com
   ```

   choose the **Owner** permission (delegated ownership for service accounts),
   and save. The Agent City service account can then read GSC data for the
   property.

## Notes

- The property does not exist yet — steps 1–7 are all that remain; nothing else
  is pending on the code side.
- Rotating the token: repeat steps 2–6. The old file starts returning 404 once
  the env var changes.
