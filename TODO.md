# Ultron — Monetization Roadmap

## Release tracking / error regression detection
Connect to GitHub webhooks or let users tag deploys via API. Automatically surface errors that first appeared after a given version/deploy. Show a "Introduced in v1.2.3" badge on the error detail page and let users filter by release. This is a major Sentry differentiator and leverages the existing GitHub integration.

**Implementation notes:**
- Add a `releases` table (`id, project_id, version, deployed_at`)
- Accept deploy events via `POST /api/ingest/release` (API key auth, same as error ingest)
- On ingest, tag each error with the nearest preceding release
- Add "regression" badge + release filter to the error table

---

## Public status page
Generate a hosted, public-facing status page from web vital data (LCP, FCP, TTFB). Requires zero extra infrastructure — vitals are already collected. High perceived value for users who want to communicate reliability to their own customers.

**Implementation notes:**
- Add a `status_page_enabled` flag and `status_page_slug` to the `projects` table
- Public route: `/status/[slug]` (no auth required)
- Aggregate good/needs-improvement/poor vital counts over the last 24h and 7d
- Show uptime-style indicator based on error rate thresholds

---

## Usage dashboard
Show users their current monthly event count vs. their plan limit directly in the dashboard. Makes the value of upgrading tangible and reduces churn by helping users understand what they're getting.

**Implementation notes:**
- Add a `monthly_event_count` column to `profiles` (reset on billing cycle) OR compute from the `errors` table grouped by `date_trunc('month', created_at)`
- Surface a usage bar in the sidebar or on the settings page
- Show a dismissible upgrade prompt at 80% and a hard warning at 100%

---

## Stripe integration
Wire up billing so `profiles.plan` can actually be set to `'pro'`. The DB column exists — this is just the payment plumbing.

**Implementation notes:**
- Add `stripe_customer_id` and `stripe_subscription_id` to `profiles`
- `POST /api/billing/checkout` — create a Stripe Checkout session
- `POST /api/billing/portal` — create a Stripe Customer Portal session (manage/cancel)
- `POST /api/billing/webhook` — handle `checkout.session.completed` and `customer.subscription.deleted` to flip `profiles.plan`
- Add a "Upgrade to Pro" button on the settings page and usage dashboard

---

## Team seat limits
Team collaboration is currently unlimited. Gating it creates a natural upgrade trigger at the moment users want to invite a second team member.

**Implementation notes:**
- Free plan: 1 invited member max (owner + 1)
- Pro plan: unlimited members
- Enforce in `POST /api/projects/[id]/members` — count existing accepted members before inserting
- Show a locked state on the invite UI with an upgrade CTA when the limit is reached

---

## Data retention tiers
Currently all errors are deleted after 30 days (`/api/errors/cleanup`). Offering longer retention for paid plans is low-effort and high-perceived-value.

**Implementation notes:**
- Free: 30 days (current)
- Pro: 90 days
- Update the cleanup job to read `profiles.plan` for each project owner before deleting
- Show retention period prominently on the pricing page and settings

---

## Alert notifications (email / Slack / webhook)
Users need to know about new errors immediately, not just when they log in. "First occurrence" and "error spike" alerts are table-stakes for error monitoring at any price point.

**Implementation notes:**
- Add an `alert_rules` table (`project_id, type ['first_occurrence'|'spike'], channel ['email'|'slack'|'webhook'], destination`)
- Trigger alerts at ingest time (or via a short-interval cron) using Resend (already integrated) for email
- For Slack: OAuth app + incoming webhook URL stored per project
- For webhooks: POST the error payload to a user-configured URL
- Add an "Alerts" section to project settings

---

## Error volume limits + overage billing
Gate the ingest endpoint on a monthly error count. Users hit the limit exactly when they need the product most — the highest-conversion moment possible.

**Implementation notes:**
- Add `monthly_event_count int default 0` and `billing_cycle_start date` to `profiles`
- Increment the counter atomically in the ingest route (Supabase RPC or Redis counter)
- Return `429 Too Many Requests` with a descriptive body when the free limit (e.g. 10,000 events/month) is exceeded
- Reset the counter on the billing cycle start date via cron (`/api/errors/cleanup` or a dedicated job)
- Pro plan: 500K events/month (configurable); overage billed via Stripe metered billing
