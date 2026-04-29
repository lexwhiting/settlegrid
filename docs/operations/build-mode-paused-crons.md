# Build-Mode Paused Crons (Mothballed, Not Deprecated)

**Status:** Active mothball as of 2026-04-10
**Purpose:** Cost containment during a focused build phase. All cron route handlers, agent code, and supporting infrastructure remain 100% intact and functional. Only the *Vercel cron schedule entries* and the *agent scheduler bootstrap* have been disabled. Restoration is a copy-paste operation.

This document is the canonical restoration reference. To bring everything back online, follow the **Restoration** section at the bottom.

---

## What's mothballed

### Vercel crons removed from `apps/web/vercel.json`

Ten cron entries were removed from the `crons` array. Each falls into one of three categories:

| # | Cron path | Original schedule | Category | Reason |
|---|---|---|---|---|
| 1 | `/api/cron/gridbot` | `0 */6 * * *` | High-cost (Claude API) | Outreach automation; serves no purpose during a no-outbound build phase. Default per-run budget ~$2 × 4/day = ~$8/day Claude spend. |
| 2 | `/api/cron/crawl-registry` | `0 */6 * * *` | High-cost (Firecrawl + crawls) | Registry indexing pipeline. The shadow directory already covers the equivalent surface; this is duplicate work that costs real money. |
| 3 | `/api/cron/crawl-services` | `0 12 * * *` | High-cost (HuggingFace/PyPI/Replicate scraping) | Same rationale as crawl-registry. Resume when active indexing is needed for new launch surfaces. |
| 4 | `/api/cron/onboarding-drip` | `0 * * * *` | Email cadence | Sends drip emails to new signups. With aspirational marketing copy now removed and a tiny user base, drip emails create more confusion than value. |
| 5 | `/api/cron/consumer-digest` | `0 10 * * 1` | Email cadence | Weekly digest to ~100 consumer accounts. With only a handful of real active users, the digest is mostly empty and may train recipients to mark us as low-value. |
| 6 | `/api/cron/newsletter` | `0 12 * * 1` | Email cadence | Weekly ecosystem newsletter to ~500 consumer accounts. Build-mode posture is no marketing burst; a weekly newsletter contradicts that posture. |
| 7 | `/api/cron/monitor-reddit` | `0 */4 * * *` | Outreach intel surfacing | Polls 12 subreddits for keywords, surfaces opportunities for outbound. We are not doing outbound right now, so the surfacing has no actionable consumer. |
| 8 | `/api/cron/monitor-stackoverflow` | `0 */6 * * *` | Outreach intel surfacing | Stack Exchange API search across 5 tag groups. Same rationale. |
| 9 | `/api/cron/monitor-github-issues` | `0 */6 * * *` | Outreach intel surfacing | GitHub Issues search across 5 query patterns. Same rationale. |
| 10 | `/api/cron/monitor-github-repos` | `0 8 * * *` | Outreach intel surfacing | GitHub repo search for new daily creates. Same rationale. |

**What is NOT touched:**
- Every removed cron's route handler under `apps/web/src/app/api/cron/*/route.ts` remains 100% intact, type-checked, and individually invokable via `curl` if you ever need to run one manually.
- The build still compiles them as Next.js routes — they just don't auto-fire.
- The `gridbot` budget config, the `crawl-registry` ecosystem rotation logic, the email templates used by `onboarding-drip` / `consumer-digest` / `newsletter`, and every monitor's keyword definitions all remain in place.

### Agent scheduler kill-switched in `/Users/lex/settlegrid-agents/`

The local agent team scheduler (`orchestrator/scheduler.ts`) now refuses to start unless `AGENT_SCHEDULER_ENABLED=true`. The `SCHEDULE` constant, all agent code, the cron module import, and every job definition remain 100% intact. Only the entry-point bootstrap is gated.

**What this affects:** running `npm run dev` (or any other invocation that loads `scheduler.ts` as the main module) now exits cleanly with a one-line warning instead of registering all the cron jobs and keeping the process alive.

**What this does NOT affect:**
- Importing `scheduler.ts` from tests or other modules still works normally (the gate only fires on the entry-point path)
- `startScheduler()` and `runJob()` exports remain callable directly for tests and ad-hoc execution
- The `SCHEDULE` constant is unchanged, so when you re-enable, every job comes back on its original schedule

**Currently active jobs that would have been firing under the agent scheduler if started:**

| Job | Schedule | Approximate cost-per-run |
|---|---|---|
| `beacon_research` | `0 4 * * *` (4 AM daily) | High — Claude Sonnet + Exa search, ~$2-5/run |
| `beacon_draft` | `0 5 * * 1,3,5` (5 AM Mon/Wed/Fri) | High — Claude draft + Firecrawl + quality checks, ~$3-8/run |
| `protocol_scan` | `0 */4 * * *` (every 4h) | High — Claude protocol analysis, ~$4-6/run |
| `protocol_report` | `0 6 * * 1` (Monday 6 AM) | Medium — summary report, ~$1-2/run |
| `indexer_full` | `0 8 * * 0` (Sunday 8 AM) | Medium-high — Claude + Exa + Firecrawl, ~$5-15/run |
| `hitl_expire` | `0 * * * *` (hourly) | Free — local in-memory ops |
| `morning_briefing` | `0 7 * * *` | Free — email-only |
| `evening_briefing` | `0 18 * * *` | Free — email-only |

Estimated combined daily cost if the scheduler were running unattended: roughly **$80-150/day**.

---

## What is still running (and why)

The following Vercel crons remain active because they are operational housekeeping or load-bearing for the live site at no meaningful API cost:

| Cron | Schedule | Why it stays |
|---|---|---|
| `health-checks` | `*/5 * * * *` | Monitors live tool endpoints; emails on real outages |
| `webhook-retry` | `*/2 * * * *` | Retries failed webhook deliveries to existing customers |
| `alert-check` | `*/5 * * * *` | Fires only when a real consumer hits a real budget alert |
| `abandoned-checkout` | `0 * * * *` | Recovers real Stripe abandoned-checkout events; low volume, zero false positives |
| `expire-sessions` | `*/10 * * * *` | DB cleanup of stale settlement sessions |
| `aggregate-usage` | `0 0 * * *` | Daily DB rollup, no API calls |
| `quality-check` | `*/15 * * * *` | DB validation, no API calls |
| `monthly-summary` | `0 9 1 * *` | Monthly admin email to founder |
| `weekly-report` | `0 9 * * 1` | Weekly admin email to founder |
| `ecosystem-metrics` | `0 9 * * 0` | Weekly npm + GitHub stats fetch, low API cost |
| `data-retention` | `0 3 * * *` | DB cleanup, no API calls |
| `anomaly-detection` | `0 */6 * * *` | Statistical DB analysis, no API calls |
| `consumer-schedules` | `*/5 * * * *` | Consumer-side state machine, DB only |
| `claim-outreach` | `0 10 * * *` | **Already gated** by `CLAIM_EMAILS_ENABLED` env var (default off). The cron fires but exits immediately with `{ skipped: true, reason: 'kill_switch' }`. Kept on the schedule so the gate is exercised regularly and any regressions are caught fast. |
| `claim-follow-up` | `0 14 * * *` | Same — gated by `CLAIM_EMAILS_ENABLED`, exits immediately. |

---

## Restoration

Restoring everything is a 2-minute, 2-step operation. **None of the underlying code needs to change.**

### Step 1: Restore the Vercel crons

Open `apps/web/vercel.json` and paste the following ten entries back into the `crons` array (the order doesn't matter, but matching the original group ordering is friendly to reviewers):

```json
{
  "path": "/api/cron/onboarding-drip",
  "schedule": "0 * * * *"
},
{
  "path": "/api/cron/crawl-registry",
  "schedule": "0 */6 * * *"
},
{
  "path": "/api/cron/monitor-reddit",
  "schedule": "0 */4 * * *"
},
{
  "path": "/api/cron/monitor-github-repos",
  "schedule": "0 8 * * *"
},
{
  "path": "/api/cron/crawl-services",
  "schedule": "0 12 * * *"
},
{
  "path": "/api/cron/gridbot",
  "schedule": "0 */6 * * *"
},
{
  "path": "/api/cron/consumer-digest",
  "schedule": "0 10 * * 1"
},
{
  "path": "/api/cron/monitor-stackoverflow",
  "schedule": "0 */6 * * *"
},
{
  "path": "/api/cron/monitor-github-issues",
  "schedule": "0 */6 * * *"
},
{
  "path": "/api/cron/newsletter",
  "schedule": "0 12 * * 1"
}
```

Commit + push. Vercel picks up the new schedule on the next deploy.

**Optional pre-restore checklist** (worth doing before flipping any of these back on, especially if a long time has passed since they were paused):
- [ ] Confirm the route handler still type-checks: `cd apps/web && pnpm test`
- [ ] Confirm relevant env vars are still set in Vercel project (e.g. `GRIDBOT_BUDGET_CENTS`, `FIRECRAWL_API_KEY`, `RESEND_API_KEY`, `REDDIT_*` if any)
- [ ] If onboarding-drip / consumer-digest / newsletter are coming back: also confirm `CLAIM_EMAILS_ENABLED=true` and any other email-related gates are flipped back on if you also paused them

### Step 2: Restore the agent scheduler

Set the env var in whatever environment runs the local agent team:

```bash
# .env.local in /Users/lex/settlegrid-agents/
AGENT_SCHEDULER_ENABLED=true
```

Then start as usual:

```bash
cd /Users/lex/settlegrid-agents
npm run dev
```

The scheduler will detect the env var, log `[scheduler] Starting scheduler with schedules:`, register all eight jobs from `SCHEDULE`, and begin running on the original cadence. No code changes required.

**Sanity check after restore:** the first scheduler boot log should list 8 jobs (`beacon_research`, `beacon_draft`, `protocol_scan`, `protocol_report`, `indexer_full`, `hitl_expire`, `morning_briefing`, `evening_briefing`). If it lists a different count, something has been edited that you should review.

---

## Cost-burn-rate sanity check (after restoration)

Once everything is restored, the steady-state cost burn is roughly:

- **Vercel crons (the 10 restored)**: ~$15-50/day combined (gridbot dominates at ~$8/day, crawl-registry/crawl-services dominate the Firecrawl line)
- **Agent scheduler (8 jobs)**: ~$80-150/day if all jobs run on schedule
- **Claim outreach + follow-up emails**: ~$0-5/day depending on Resend volume (gated by `CLAIM_EMAILS_ENABLED` separately — see `apps/web/src/app/api/cron/claim-outreach/route.ts`)

If you restore everything and your daily AI/infra spend is materially different from the above, something has changed since this document was written and you should investigate before assuming the restoration is correct.

---

## Notes

- **This is a mothball, not a deprecation.** Every line of code that ran before this pause still runs after restoration. No tests were removed. No route handlers were changed. No agent files were touched. The decision to remove a cron permanently is a separate, future decision that should have its own deliberation.
- **No git history rewriting.** The original Vercel cron entries are recoverable via `git log apps/web/vercel.json` if this doc ever gets out of sync with the truth. The kill-switch commit also has a clear `Refs:` trailer for trace-back.
- **The kill switch defaults to OFF in both places.** Bringing the systems back online requires affirmative action (paste JSON / set env var). This is intentional — accidentally restarting an expensive system because of a default-on configuration is a worse failure mode than accidentally leaving it off.
