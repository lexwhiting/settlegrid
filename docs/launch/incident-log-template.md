# Launch Day Incident Log — TEMPLATE

**On launch day:** copy this file to `docs/launch/incident-log-2026-MM-DD.md`
and fill in row-by-row as incidents fire. Append-only — never delete or
edit prior rows. Future-you uses this for the post-mortem and to schedule
permanent fixes for anything that fired more than once.

**One row per incident.** If a single incident has multiple actions
(detect → mitigate → resolve), use multiple rows with the same `Incident
ID` and increment `Action #`.

**Time format:** ISO 8601 in UTC (`2026-04-27T14:35:12Z`). Use UTC so the
log lines up with Vercel/Sentry/PostHog timestamps without timezone math.

---

## Active timeline

| Timestamp (UTC) | Incident ID | Action # | Symptom | Action taken | Outcome | Playbook # |
|---|---|---|---|---|---|---|
| 2026-04-27T14:00:00Z | — | — | (Pre-launch smoke green) | Ran `bash scripts/launch-day-smoke.sh` | All checks PASS | — |
| 2026-04-27T14:30:00Z | — | — | (HN post submitted) | Submitted to https://news.ycombinator.com/submit | Live at https://news.ycombinator.com/item?id=XXXXXXXX | — |

<!--
EXAMPLE rows — delete or replace before going live. Format:

| 2026-04-27T15:12:08Z | INC-001 | 1 | HN reply: "npx hangs on Node 18" | Replied "we support Node 20+, try nvm install 20" | User confirmed fixed | #1 |
| 2026-04-27T15:14:30Z | INC-002 | 1 | Dashboard p95 jumped to 4.2s | Identified long-running gallery query | DB connections refilled | #9 |
| 2026-04-27T15:14:55Z | INC-002 | 2 | Same query hanging | `pg_cancel_backend(pid)` on the offender | Pool freed in 8s | #9 |
| 2026-04-27T15:18:00Z | INC-002 | 3 | DB looks normal | No further action | Resolved | #9 |
| 2026-04-27T16:42:11Z | INC-003 | 1 | Stripe webhook 500s, 12 retries pending | Tailed logs, found signing-secret mismatch | Rotated STRIPE_WEBHOOK_SECRET | #8 |
| 2026-04-27T16:43:30Z | INC-003 | 2 | New secret deployed | Replayed pending events | All caught up | #8 |
-->

---

## Outage windows

Note any window where any product surface (gallery, scaffold, billing) was
visibly broken to users. Used in the post-mortem.

| Started (UTC) | Ended (UTC) | Surface | Severity | Notes |
|---|---|---|---|---|
| | | | | |

Severity: **P1** = users can't transact (signup or pay broken). **P2** =
core flow degraded (gallery slow, scaffold partial). **P3** = nice-to-have
broken (admin dashboard, telemetry).

---

## Comms log

What we said publicly during the launch. Used to verify we kept our story
straight.

| Timestamp (UTC) | Channel | Audience | Message | Link |
|---|---|---|---|---|
| | | | | |

Channels: HN, X, blog status banner, email-to-affected-user.

---

## Post-launch action items

Anything that fired during the war room and warrants a permanent fix
(monitor, doc, code change). Schedule a `/schedule` follow-up agent for
each.

- [ ] (e.g. "incident #1 fired 4 times — add Node-version check to CLI
      preflight; PR by 2026-05-04")
- [ ] (e.g. "incident #5 fired once — bake `revalidate = 60` into gallery
      permanently; PR by 2026-05-01")

---

## Smoke runs

Every 30 min during the launch. Paste the smoke script's last line.

| Timestamp (UTC) | Smoke result | Notes |
|---|---|---|
| 2026-04-27T14:00:00Z | PASS — all 6 checks green | Pre-launch baseline |
| | | |
