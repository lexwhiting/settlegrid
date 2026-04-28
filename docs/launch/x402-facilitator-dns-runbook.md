# `facilitator.settlegrid.ai` — DNS Provisioning Runbook

**Use:** the founder follows this top-to-bottom to provision the public
x402 facilitator subdomain. Time budget: ~10 minutes including
verification. Sections are sequential — do not skip.

**Why this exists:** the P4.MKT2 routes (`/v1/{verify,settle,supported}`)
are wired in code at `apps/web/src/app/api/x402/facilitator/v1/*` and
the Vercel rewrite is in `apps/web/vercel.json`. Both ship in the same
deploy. The only thing this runbook adds is the actual DNS record + a
verification pass before the announcement post is flipped to
`published: true`.

---

## Prerequisites

- [ ] You can log into the registrar where `settlegrid.ai` lives (Cloudflare,
      Namecheap, etc. — whichever DNS provider holds the zone)
- [ ] You can log into Vercel as a member of the `settlegrid` project
- [ ] The `staging/phase-4-launch-batch` PR (the one carrying P4.MKT2 +
      this runbook + the rewrite) is merged into `staging/nuclear-expansion`
      and the staging environment build is green

---

## Step 1 — Add the domain in Vercel

This must happen BEFORE adding the DNS record so Vercel can issue an
SSL certificate immediately when the CNAME resolves.

1. Vercel dashboard → `settlegrid` project → **Settings** → **Domains**.
2. Click **Add Domain**, enter `facilitator.settlegrid.ai`, click Add.
3. Vercel shows the required DNS configuration. **Take a screenshot** —
   you'll need the exact CNAME target value in Step 2.
4. Confirm the domain is associated with the **Production** *or*
   **Staging** environment per your branch wiring. For day-one launch,
   point at the same environment where the rest of `settlegrid.ai`
   lives — usually Production.
   - If you want the facilitator on Staging only initially: in Vercel,
     mark the domain as Preview-only and bind it to the
     `staging/nuclear-expansion` branch. Switch to Production once
     external smoke is green (Step 4).

> **Why Vercel-first, DNS-second:** if you add the CNAME first, Vercel's
> automatic certificate request races the DNS propagation and may
> generate a "challenge failed" error that takes 5-10 minutes to clear.
> Adding the domain in Vercel first means it's ready the instant the
> record propagates.

---

## Step 2 — Add the CNAME record at the registrar

Log into your DNS provider for `settlegrid.ai`.

Add **one** new record:

| Field | Value |
|---|---|
| Type | `CNAME` |
| Name / Host | `facilitator` |
| Value / Target | (the value Vercel showed in Step 1, typically `cname.vercel-dns.com`) |
| TTL | `Auto` (or 300 seconds — anything ≤ 5 min) |
| Proxy / Cloudflare orange cloud | **OFF** — Vercel handles SSL termination; double-proxying through Cloudflare's orange cloud breaks the cert challenge |

**Save the record.**

> **If the registrar is Cloudflare:** disable the orange-cloud proxy
> for the `facilitator` record specifically. Cloudflare will offer a
> grey-cloud (DNS-only) option — pick that. The rest of the
> `settlegrid.ai` zone can keep whatever proxy setting it had.

---

## Step 3 — Wait for propagation + verify the record

Resolution typically takes 1-3 minutes for low-TTL records. Verify
from your terminal:

```sh
# Should return cname.vercel-dns.com (or whatever Vercel specified):
dig +short facilitator.settlegrid.ai CNAME

# Or via Google's public resolver to bypass any local DNS cache:
dig +short facilitator.settlegrid.ai CNAME @8.8.8.8

# Sanity-check the resolved A records (Vercel's edge IPs):
dig +short facilitator.settlegrid.ai
```

If `dig` returns empty for ≥5 minutes after adding the record,
something is misconfigured — check the registrar UI for typos in the
Name field (`facilitator` not `facilitator.settlegrid.ai` — most
registrars auto-append the zone).

Once `dig` returns the expected CNAME, in Vercel **Settings → Domains**
the row for `facilitator.settlegrid.ai` should flip from "Invalid
Configuration" to **Valid Configuration** with a green check, and the
SSL cert badge should appear within ~30 seconds.

---

## Step 4 — Smoke-test the three endpoints from outside

The smoke script `scripts/x402-facilitator-smoke.sh` curls all three
endpoints and reports green/red. Run it from a personal laptop NOT on
the SettleGrid dev box, ideally on a different network than the dev
machine, to catch any "works locally only" regressions:

```sh
# From the repo root, against the public facilitator:
bash scripts/x402-facilitator-smoke.sh

# Or against a Vercel preview deployment URL before you cut over DNS:
bash scripts/x402-facilitator-smoke.sh --base https://settlegrid-git-staging-phase-4-launch-batch-<team>.vercel.app
```

Expected output: 3 green checks (supported, verify-malformed-request,
settle-malformed-request — the tests use deliberately invalid payloads
so they don't hit the gas wallet). Total wall-clock: <30 seconds.

If any check is RED, do NOT proceed to Step 5. Open a GitHub issue
with the failing output and triage. Common failures:

- **404 on all three** — the Vercel rewrite isn't wired. Confirm
  `apps/web/vercel.json` has the `rewrites` block with `host` filter
  matching `facilitator.settlegrid.ai`.
- **502 on all three** — the apps/web build failed silently. Check
  Vercel deployment logs for the most recent build.
- **`/v1/supported` returns ETH mainnet in `networks`** — your route
  isn't applying the day-one allowlist filter. Confirm the deployment
  picked up `PUBLIC_FACILITATOR_NETWORKS = ['eip155:8453', 'eip155:84532']`
  from `supported/route.ts`.

---

## Step 5 — Flip the announcement post to `published: true`

Once Step 4 is all-green, edit `apps/web/src/lib/blog-posts.ts` and
change the line under the `slug: 'x402-facilitator-launch'` entry:

```diff
-    published: false,
+    published: true,
```

Commit on the same branch (`staging/phase-4-launch-batch` or whatever
the staging branch is by then), push, wait for the Vercel build, then
verify:

```sh
# Should return 200 with the post body:
curl -sS -o /dev/null -w "%{http_code}\n" https://settlegrid.ai/learn/blog/x402-facilitator-launch
```

The blog index at `https://settlegrid.ai/learn/blog` should now list
the post.

---

## Step 6 — (Optional) UptimeRobot widget integration

The landing page at `/protocols/x402/facilitator` currently shows
"Open incidents · uptime widget pending." To replace with a real
uptime indicator:

1. Sign up for UptimeRobot (free tier covers 50 monitors).
2. Add three HTTP(s) monitors:
   - `https://facilitator.settlegrid.ai/v1/supported` (GET, 60s)
   - `https://facilitator.settlegrid.ai/v1/verify` with a known-bad
     POST body (expect 422 — UptimeRobot allows "expected status code"
     filtering)
   - `https://facilitator.settlegrid.ai/v1/settle` similar
3. Create a Public Status Page in UptimeRobot. Note the public URL
   (looks like `https://stats.uptimerobot.com/<slug>`).
4. Add `UPTIMEROBOT_STATUS_URL=https://stats.uptimerobot.com/<slug>`
   to Vercel environment variables (Production scope).
5. The landing page already has the integration code; it reads the env
   var on page render and replaces the placeholder badge with a link
   to the status page + a JSON-fetched current-status string.

If you skip this step, the placeholder ("Open incidents · uptime
widget pending") stays in place. The facilitator still works; readers
just don't get a live-uptime number.

---

## Rollback

If anything in Steps 1-5 misfires:

1. **DNS:** delete the CNAME record in the registrar UI. Within 5 min
   (TTL), `facilitator.settlegrid.ai` returns NXDOMAIN.
2. **Vercel:** Settings → Domains → remove `facilitator.settlegrid.ai`
   from the project. The deploy itself is unaffected.
3. **Blog post:** flip `published: true → false` in `blog-posts.ts`,
   commit, push. The route returns 404 within ~60 seconds (Vercel
   cache). The post draft stays in the repo; only its visibility
   changes.

The four code artifacts (3 routes + landing page + blog body + Vercel
rewrite) are left in place — they're inert without DNS pointing the
subdomain at them. Re-running this runbook restores everything in
~10 minutes.

---

## Pre-launch sanity checklist (run T-1 hour before the Discord post)

- [ ] `dig +short facilitator.settlegrid.ai CNAME` returns the Vercel target
- [ ] `curl -sS https://facilitator.settlegrid.ai/v1/supported | jq .networks` returns exactly 2 networks (Base mainnet + Base Sepolia)
- [ ] `bash scripts/x402-facilitator-smoke.sh` is all-green
- [ ] `https://settlegrid.ai/learn/blog/x402-facilitator-launch` returns 200
- [ ] `https://settlegrid.ai/protocols/x402/facilitator` renders with the endpoint table
- [ ] (Optional) UptimeRobot status page link works, badge updates within 60 seconds

When every box is checked, you're cleared to post to the x402
community Discord.
