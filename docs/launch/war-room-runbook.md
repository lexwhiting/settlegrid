# Launch Day War Room — Incident Runbook

**Use:** the founder reads this top-to-bottom before launch and keeps it open
in a tab during launch. Every playbook is sized for a 2-minute fix from the
moment of detection. If a fix takes longer than 2 minutes, the playbook tells
you when to escalate (page on-call, post a status note, or roll back).

**Each playbook has:**
- **Symptom** — exact string you'll see in the dashboard, log, or HN reply
- **Likely cause** — the failure mode that produced the symptom
- **2-min fix** — the command/click/SQL that resolves it
- **Escalation** — when 2 minutes is up
- **Comms** — what to say on HN/X if the public is watching

**Source of truth for live state:** `/admin/launch-dashboard`. **Smoke test:**
`bash scripts/launch-day-smoke.sh` (run every 30 minutes, also right before
posting to HN). **Status comms channel:** founder X account. Pin the launch
post; reply to HN comments inline.

> ⚠️ Never apologize for an outage on HN until you have the fix deploying.
> "Working on it, ETA 3 minutes" beats "Sorry, looking into it" by an order
> of magnitude.

---

## 1. CLI install fails on Node 18

**Symptom:** PostHog dashboard shows `cli_install_started` with
`node_version: "18.x"` followed by zero `scaffold_success` events for that
session. HN comment says "npx settlegrid hangs / errors on Node 18".

**Likely cause:** the SDK or CLI imports a package whose latest version
dropped Node 18 (e.g. a transitive ESM-only dependency). The `engines` field
in `packages/settlegrid-cli/package.json` says `>=20` but `npx` does not
enforce it strictly.

**2-min fix:** post a one-liner in the HN reply telling the user to upgrade
to Node 20. If the founder owns the repo whose engines field is wrong, edit
the line and `npm publish` a patch. Do **not** ship a Node-18 compat layer
under load.

```text
You're on Node 18 — it hit end-of-life on 2025-04-30. Try `nvm install 20 &&
nvm use 20`, then `npx settlegrid scaffold ...`. We support Node 20+.
```

**Escalation:** if 5+ HN commenters report the same thing, edit the README
to call out Node 20+ in the install section and pin a comment.

**Comms:** never blame the user. "We support Node 20+" is the line.

---

## 2. CLI install fails on Node 20+

**Symptom:** `cli_install_started` events with `node_version: "20.x"` or
`"22.x"` followed by zero scaffolds. Error in user terminal mentions
`ERR_MODULE_NOT_FOUND` or `Cannot find module '@settlegrid/...'`.

**Likely cause:** a published package's `exports` map is wrong, or a peer
dep wasn't bumped, or `npm publish` shipped without the dist files.

**2-min fix:**
```sh
# Verify the published package actually contains dist/
npm view @settlegrid/cli files
npm view @settlegrid/cli dist-tags
# If files looks empty or 'latest' is wrong, republish:
cd packages/settlegrid-cli && npm version patch && npm publish --access public
```

**Escalation:** if the bad version is the one HN commenters tried, run
`npm dist-tag rm @settlegrid/cli latest` and push the previous version's tag
back to `latest` — buys you time to fix forward without users hitting the
broken version.

**Comms:** "Found it — bad publish. Patch out in 90 seconds. Hold tight."

---

## 3. CLI fails behind corporate proxy

**Symptom:** HN/X user reports `getaddrinfo ENOTFOUND` or `ECONNREFUSED`
during `npx settlegrid scaffold`. Their company sits behind a proxy.

**Likely cause:** npm proxy env vars (`HTTP_PROXY`, `HTTPS_PROXY`) aren't
set, or the registry cert isn't trusted by Node.

**2-min fix:** reply with the proxy doc. Do not try to fix this in our
code — the user's network is not our problem.

```text
That's a corporate proxy issue. Set HTTPS_PROXY and HTTP_PROXY env vars
before running, or run `npm config set proxy http://your-proxy:port`. If
your company uses a custom CA, add NODE_EXTRA_CA_CERTS=/path/to/cert.pem.
```

**Escalation:** if 3+ users report this, add a "Behind a corporate proxy?"
section to the README and link it from CLI error output.

**Comms:** factual, link the npm docs at https://docs.npmjs.com/cli/v10/using-npm/config#proxy.

---

## 4. Scaffold command hangs

**Symptom:** dashboard shows `cli_install_started` without a matching
`scaffold_success` or `scaffold_failed` within 60 seconds. User reports
"it just sits there".

**Likely cause:** the scaffold downloads a tarball from GitHub; if GH is
slow or rate-limiting unauthenticated `git archive` calls, the scaffold
appears to hang. There is no progress UI (a known papercut).

**2-min fix:** confirm GitHub is up via https://www.githubstatus.com/. If
GH is degraded, post a status note. If GH is fine, the user's network is
slow — ask them to add `--verbose` and share the output.

**Escalation:** if hang is reproducible from your own machine, the issue is
the codemod step (after the download). Run scaffold with `DEBUG=1` locally
and read the trace; if it's the codemod, kill the user's session by asking
them to Ctrl+C and try a different template.

**Comms:** "Are you on a slow network? The scaffold downloads a tarball
from GitHub — it should finish in <10s normally. Share `npx settlegrid
scaffold ... --verbose` output and I'll look."

---

## 5. Gallery page 500s under load

**Symptom:** `/admin/launch-dashboard` shows error rate spike. Vercel
dashboard shows 5xx on `app/gallery`. HN commenters say "site is down".

**Likely cause:** Vercel function timeout (default 10s) hit by a database
query that fans out across hundreds of templates. Or pgBouncer pool full
(see #9).

**2-min fix:**
```sh
# 1. Confirm gallery is the failing route
vercel logs --prod | grep "GET /gallery" | tail -20
# 2. If 504s, the function timed out. Push a hotfix that caches the gallery
#    in Edge config or returns the static fallback:
git checkout -b hotfix/gallery-cache
# Edit apps/web/src/app/gallery/page.tsx — set `export const revalidate = 60`
# (revalidate every 60s, serve cached HTML in between)
git commit -am "hotfix: cache gallery for 60s under launch load"
git push -u origin hotfix/gallery-cache && gh pr create --base main --fill
# Vercel auto-deploys from PR; merge as soon as preview is green
```

**Escalation:** if the deploy itself fails (#15), serve a static gallery
snapshot from `apps/web/public/gallery-snapshot.html`. Write that file once
on launch morning so it's already there when this fires.

**Comms:** "Caching layer wasn't aggressive enough — fix deploying now,
ETA 2 min."

---

## 6. Shadow directory 404s for specific repo

**Symptom:** user reports `/shadow/<owner>/<repo>` returns 404 for a repo
they know exists in our index.

**Likely cause:** the slug in the URL has unusual characters (uppercase,
dots, plus signs) and our route's path matcher chokes. Or the row is in
the DB but flagged `hidden = true` (DMCA safety net).

**2-min fix:**
```sql
-- Check if the row exists at all. Real schema (verified 2026-04-27):
-- mcp_shadow_index columns are id, source, owner, repo, name,
-- description, category, tags, stars, downloads, last_updated,
-- source_url, settlegrid_available, indexed_at. There is NO soft-
-- delete column; if a row needs to disappear it gets DELETEd (see #13).
SELECT owner, repo, source, settlegrid_available, indexed_at
FROM mcp_shadow_index
WHERE LOWER(owner) = LOWER('owner-from-url')
  AND LOWER(repo) = LOWER('repo-from-url');
```

If the row exists but the page 404s, the route handler is the bug —
check Vercel logs for `/shadow/<owner>/<repo>` and look for slug-encoding
issues in `apps/web/src/app/shadow/[owner]/[repo]/page.tsx`.

**Escalation:** if the row does not exist at all, it's expected — the
shadow index is a snapshot and gets refreshed on a schedule. Tell the
reporter we'll have it next refresh.

**Comms:** for the missing-from-index case: "Our shadow index refreshes
every few hours; we'll pick that repo up on the next pass." For
hidden-by-mistake: "Fixed — try again."

---

## 7. PostHog stops receiving events

**Symptom:** `/admin/launch-dashboard` PostHog cards show stale counts.
Last event timestamp >5 minutes old.

**Likely cause:** (a) PostHog API outage (check
https://status.posthog.com/), (b) our proxy at `/api/telemetry/capture` is
500ing, (c) `POSTHOG_API_KEY` env var was rotated and the new value isn't
deployed.

**2-min fix:**
```sh
# Smoke the proxy directly
curl -X POST https://settlegrid.ai/api/telemetry/capture \
  -H "Content-Type: application/json" \
  -d '{"event":"gallery_viewed","properties":{},"distinct_id":"smoke-test"}'
# Expect 204 No Content. If 401: API key missing in Vercel.
# If 502: proxy code is broken — see Vercel logs.
```

If env var: `vercel env pull .env.production.local` to inspect, then
re-add via Vercel dashboard and redeploy.

**Escalation:** PostHog's own outage is out of our hands — events are
fire-and-forget at our end (the proxy returns 204 either way). Acknowledge
on X if dashboard stays dark for >15 min.

**Comms:** none unless commenters notice the dashboard. The blog post does
not promise live metrics.

---

## 8. Stripe webhook fails

**Symptom:** `/admin/launch-dashboard` "Active Stripe connections" card
hasn't moved despite signup spike. Stripe dashboard shows webhook delivery
failures (red dot).

**Likely cause:** (a) webhook signing secret mismatch (we have STAGING and
PROD secrets — easy to mix up under stress), (b) our handler at
`/api/stripe/webhook` 500s, (c) the response is too slow and Stripe times
out at 30s.

**2-min fix:**
```sh
# Inspect last 10 webhook attempts in Stripe dashboard
open "https://dashboard.stripe.com/webhooks"
# Replay the last failure to see the error body
stripe events resend evt_xxx --webhook-endpoint we_xxx
# Tail Vercel logs for the webhook handler
vercel logs --prod -f | grep "stripe/webhook"
```

If signing-secret mismatch: regenerate the endpoint in Stripe, copy new
secret to `STRIPE_WEBHOOK_SECRET` in Vercel, redeploy.

**Escalation:** Stripe retries failed webhooks for 3 days, so we have time.
If the handler itself is broken, deploy a noop that returns 200 on every
event temporarily and reconcile state from the Stripe API later.

**Comms:** none publicly. Email any signups whose state looks wrong by
end of day.

---

## 9. Database connection pool exhausted

**Symptom:** `/admin/launch-dashboard` shows DB p95 spiking past 5s.
Errors mention `remaining connection slots are reserved` or
`pgbouncer: pool exhausted`.

**Likely cause:** under load each route opens its own connection and
pgBouncer's transaction-pooling pool fills. Or a long-running query is
holding a connection.

**2-min fix:**
```sql
-- Identify long-running queries
SELECT pid, now() - query_start AS duration, state, query
FROM pg_stat_activity
WHERE state = 'active' AND now() - query_start > interval '5 seconds'
ORDER BY duration DESC LIMIT 10;
-- Kill the worst offender (only the founder runs this)
SELECT pg_cancel_backend(<pid>);  -- soft cancel
SELECT pg_terminate_backend(<pid>);  -- hard kill if cancel doesn't work
```

If there's no single offender, the pool is just full — bump pgBouncer
`max_client_conn` in Supabase's pooler settings and redeploy. (This
requires a few-minute dashboard tweak; not strictly 2-min, but the kill
buys breathing room.)

**Escalation:** if the pool keeps refilling, put up a maintenance page on
the homepage and triage. The launch can survive 30 minutes of degraded
service; it cannot survive a meltdown that bricks signups.

**Comms:** "DB under heavier-than-expected load — scaling up the pool now,
2 min ETA." Honest is better than mysterious.

---

## 10. Rate limit triggered on legitimate traffic

**Symptom:** HN/X user reports `429 Too Many Requests` on `/gallery` or
`/api/sdk/...`. They're not abusing — just clicked around.

**Likely cause:** the IP-based rate limit is too tight for the launch
volume. Defaults: `apiLimiter = 100 / 1m`, `sdkLimiter = 1000 / 1m`. NAT'd
office networks can blow through 100/min just by browsing.

**2-min fix:**
```sh
# Bump the limit live via Upstash Redis (no redeploy needed):
# 1. Identify the IP getting 429s
vercel logs --prod | grep "429" | tail -5
# 2. Whitelist their IP in Upstash for the next 24h, OR raise the global
#    limit. Easiest is to bump the env var that controls the rate-limit:
vercel env add API_RATE_LIMIT_PER_MIN 300 production
vercel --prod  # redeploy with the new env
```

If the rate-limit module reads from env at request time, this is no-redeploy.
Worth verifying ahead of launch — see `apps/web/src/lib/rate-limit.ts`.

**Escalation:** if specific IPs are clearly abusing (>1000 req/min), keep
the limit and DNS-block them at Vercel's IP allowlist. Don't soften limits
for everyone to placate one bad actor.

**Comms:** "Rate limit was too tight for launch traffic — raising it now."

---

## 11. Template registry build fails mid-launch

**Symptom:** `/templates` shows fewer cards than expected. The build log
in Vercel shows `npm run build:registry` failed during deploy.

**Likely cause:** a template's manifest changed shape, or a template
GitHub repo became 404 (deleted), or `apps/web/public/registry.json` is
stale because the build script errored before writing it.

**2-min fix:**
```sh
# Run the registry build locally against the production env
DATABASE_URL=... npm run build:registry
# Read the error. If it's a single bad template, exclude it temporarily
git checkout -b hotfix/registry-skip-bad-template
# Edit scripts/build-registry.ts to skip the bad slug
git commit -am "hotfix: skip <slug> in registry until upstream fixed"
git push -u origin hotfix/registry-skip-bad-template
gh pr create --base main --fill
```

**Escalation:** if the registry file is missing entirely, restore from
the last known good `registry.json` (committed in the repo, so just `git
checkout main -- apps/web/public/registry.json` from the previous
good commit and ship that as a hotfix).

**Comms:** none unless gallery is visibly broken.

---

## 12. Someone posts a security issue on HN

**Symptom:** HN comment claims to have found a vuln (XSS, IDOR, SSRF,
missing auth, leaked secret in JS bundle, etc.).

**Likely cause:** could be real, could be drive-by FUD, could be misread.
Treat as real until disproven.

**2-min fix:** **do not debate publicly.** Reply once with:
```text
Thanks — DM me at lexwhiting@gmail.com with details and I'll triage now.
```

Then go investigate. **If real and exploitable from a single GET:** push
an immediate revert/hotfix that closes the surface (return 401, disable
the route via a feature flag, etc.). If revert needs review: push a
front-loaded mitigation (rate limit to 1/min, IP-allowlist the route)
while you craft the real fix.

**Escalation:** if it's a credentialed exploit and you can't fix in 10
minutes, take the affected route offline (Vercel deployment protection or
a 503 returned from the route handler) until the fix lands.

**Comms (after fix is live):** "Closed it — fix shipped at <commit>.
Thanks for the report. Public writeup: <link or 'coming soon'>."

---

## 13. Bogus DMCA against the shadow directory

**Symptom:** email from a "Foo Inc legal team" demanding takedown of
`/shadow/<owner>/<repo>` because they claim the README is theirs.

**Likely cause:** GitHub README content is the upstream's IP, but linking
to a public GitHub repo is fair indexing (this is what every search engine
does). Some companies send aggressive notices anyway.

**2-min fix:** the shadow_index table has no soft-delete column
(verified 2026-04-27 against schema). The DMCA workflow is therefore:
DELETE the row to take the page dark, snapshot the source data into a
private location first so we can restore if the claim is bogus. The
source crawler will re-add the row on next refresh unless we add the
slug to a denylist — see crawler config in
`scripts/shadow-crawler/index.ts`.

```sql
-- 1. Capture full row state for the audit trail (run BEFORE delete)
SELECT * FROM mcp_shadow_index
WHERE owner = 'foo' AND repo = 'bar' \gset
-- (paste this output into docs/launch/incident-log-<date>.md, in the
--  comms log row for the DMCA event)

-- 2. Take the page dark
DELETE FROM mcp_shadow_index WHERE owner = 'foo' AND repo = 'bar';

-- 3. Log via audit_logs (real table) — uses jsonb details column
INSERT INTO audit_logs (action, resource_type, details)
VALUES (
  'shadow.dmca_takedown',
  'mcp_shadow_index',
  jsonb_build_object(
    'owner', 'foo',
    'repo',  'bar',
    'reason', 'DMCA notice received YYYY-MM-DD; under review',
    'restorable', true
  )
);
```

After the takedown, add the `foo/bar` slug to the crawler's denylist so
the next refresh doesn't re-add it. If the DMCA claim turns out to be
bogus, the snapshot from step 1 has every column needed to re-INSERT.

**Escalation:** if the company keeps escalating, send a counter-notice or
loop in a lawyer. There's no rush at 2-min scope; the page is dark.

**Comms:** silent. Do not engage publicly with takedown disputes during
launch.

---

## 14. HN post is flagged/killed

**Symptom:** HN post URL no longer reachable via the front page or `/show`.
Vote count stops increasing. URL still resolves but page shows
"[flagged]" tag or "[dead]".

**Likely cause:** (a) genuine flag-spam from competitors, (b) HN moderator
saw something they didn't like (deceptive title, wrong category, repost),
(c) post was buried for being self-promo without enough substance.

**2-min fix:** **do not repost the same URL.** HN moderators see reposts.
Email `hn@ycombinator.com` once, brief and humble:
```
Hi — my Show HN at <url> got flagged. I'm the founder of SettleGrid; it's
a per-call billing wrapper for MCP servers, fully open source. Happy to
revise title or post content if there's something off. — <name>
```

dang/sctb usually replies within hours and either un-flags or explains.

**Escalation:** if no response in 4 hours and the post is dead-dead,
coordinate a re-launch on a different surface (Twitter, Product Hunt,
direct outreach in P4.6). Do **not** create a sock-puppet HN account.

**Comms:** on X, "Show HN got flagged — emailed dang. Meanwhile, here's
the link directly: <url>." Keep moving.

---

## 15. Vercel deployment fails during hotfix

**Symptom:** PR merged but Vercel shows BUILD FAILED on the production
deployment. Site is still on the previous deploy (which is the broken
one we were trying to fix).

**Likely cause:** the hotfix branch wasn't run through `npm run build`
locally before merge, and a TypeScript error or env-var lookup failed in
prod.

**2-min fix:**
```sh
# Read the failing build log
vercel logs --prod --build-only | tail -50
# If it's a missing env var: add it via Vercel dashboard, redeploy with:
vercel --prod --force
# If it's a TS error: fix it locally, push to the same branch:
npm run build  # confirm green locally
git commit -am "hotfix: fix build error from previous hotfix"
git push origin hotfix/<name>
# Vercel auto-rebuilds the merged commit
```

**Escalation:** if you can't get prod green in 5 minutes, **roll back**:
in Vercel dashboard → Deployments → click the last-known-good deploy →
Promote to Production. This restores the working state in <30 seconds
while you fix forward on a new branch.

**Comms:** "Hotfix had a typo, rolled back to last good build, retrying
in a sec." Embarrassing-but-recoverable beats silent-and-broken.

---

## Pre-launch sanity checks (run T-2 hours)

Before you post to HN, in this order:

1. `bash scripts/launch-day-smoke.sh` — must be all-green
2. Visit `/admin/launch-dashboard` — confirm all 7 cards render
3. Confirm Vercel deployment status: green checkmark on `main`
4. Confirm `registry.json` was rebuilt today (check file mtime)
5. Set browser bookmarks: this runbook, the dashboard, Vercel logs,
   Stripe webhooks, Supabase SQL editor, the HN submit page
6. Open the incident log at `docs/launch/incident-log-template.md` —
   copy to `docs/launch/incident-log-2026-MM-DD.md` with today's date
7. Open one terminal tab pre-authed to `vercel`, `gh`, and `npm` (so the
   hotfix-deploy pattern works without pause-to-auth under load)

After T-0 (HN post is live):

- Check the dashboard every 15 minutes, the smoke script every 30 minutes
- Reply to the first 5 HN comments within 10 minutes (response kit at
  `docs/launch/show-hn-response-kit.md`)
- Don't deploy any non-hotfix code until 24 hours after launch — every
  push is a chance to break something

## Post-launch (T+24h)

- Run smoke one more time, confirm all green
- Read the incident log; anything that fired more than once should
  become a permanent fix (PR, monitoring alert, or doc update)
- Schedule a follow-up agent: 7-day cleanup of any temp workarounds
  introduced during the war room
