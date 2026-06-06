# (N) authenticated-route `auth.id` rate-limit keying — RESOLUTION (DEBT #1c) — 2026-06-06

> Closes **#1c**, the last open part of HIGH-severity **DEBT #1**. With (a) fail-open availability
> (H1) and (b) platform-trusted IP via `getClientIp` (M) already shipped, this adds the **post-auth,
> identity-keyed rate-limit layer** — completing the two-layer model the register sketched at line (c).
> Build plan: `n-authid-rate-limit-keying-build-plan-2026-06-05.md` (v2 FINAL / PLAN_READY).
> Build handoff: `n-authid-keying-build-handoff-2026-06-06.md`.

## What shipped

At **122 guard sites across 95 session-authenticated route files** (the plan's Appendix-A census), a
per-user rate-limit block was inserted immediately after auth success:

```ts
const userRl = await checkRateLimit(<sameLimiter>, `<samePrefix>:uid:${<authVar>.id}`)
if (!userRl.success) {
  return <byte-identical args to the handler's existing IP-layer 429 return>
}
```

- **Two-layer model:** the pre-auth IP limit is untouched; the uid layer *adds* a post-auth per-identity
  cap. Upstash keys the `…:uid:<id>` window independently of the `…:<ip>` window (same limiter instance,
  separate identifiers → separate windows).
- **D1 scope (founder-locked):** session-auth routes only. The settlement rails (`sessions/* x402/* ap2/*
  circle-nano/* outcomes/* settlements/*`), SDK paths (`sdk/*`), `proxy/[slug]`, and `cron/*` are OUT.
  `tools/[id]/health` is **EXCLUDED** — its guard is optional-auth (public fallthrough), so a uid layer
  there would be anonymous-bypassable and could only throttle the legitimate authenticated owner; it
  stays IP-only (round-1 audit decision).
- **D2 limiter reuse (founder-locked):** each uid block reuses *that handler's existing limiter* —
  `apiLimiter` everywhere except `tools/claim` (`authLimiter`). No new limiter, export, or tunable number;
  `lib/rate-limit.ts` and `lib/middleware/auth.ts` are byte-stable.
- **Insert-only:** pure insertion at every site except the single X1 line — `auth/mfa` POST had no hoisted
  `let auth`, so the transform inserted `let auth` before the try and changed `:67` to
  `auth = await requireDeveloper(request)` (the chunk's ONLY modified production line). `git diff --numstat`
  over the 95 files: deletions 0 for 94, exactly 1 for `auth/mfa/route.ts`.
- **+6 tests (T1–T6), zero edits to existing tests:** per-class 2nd-call-429 + Nth-key assertions
  (payouts/dev, consumer/balance, orgs POST, tools/publish PUT), the X1 mfa proof in a new
  `__tests__/n-uid-rate-limit.test.ts`, and the T6 negative (failed auth ⇒ exactly one `checkRateLimit`
  call — a regression pin for "uid layer never fires pre-auth").

### Per-class placement (plan R4)
V1a ×108 (after the hoisted `try/catch`) · V1b ×4 (`consumer/schedules{,/[id]}` — after the bare guard) ·
V2 ×7 (`orgs/*` — after the existing post-auth IP block) · V3 ×1 (`admin/signup-followup` `requireAdmin`
helper, before the `ADMIN_EMAILS` check, `{ok:false, response}` shape) · V4 ×1 (`tools/publish` PUT,
`errorResponse` with `requestId` 4th arg) · X1 ×1 (`auth/mfa` POST hoist+capture). The 2 split-interpolation
sites (`chargeback-unpause:`, `payout-schedule:`) keep their IP lines byte-identical.

## Honest value framing

- **Fixes:** a distributed authenticated abuser (many source IPs, one account) was previously capped only
  per-IP and could dodge the cap by rotating IPs; they are now capped **per-identity per handler-prefix**
  regardless of IP spread. Adds per-user accountability symmetric with the SDK surface (already keyed on
  `consumerId`).
- **Does NOT fix (deliberate):** shared-NAT collective throttling — the pre-auth IP layer keeps its current
  numbers, so an aggregate >100/min from one NAT egress IP still 429s pre-auth. Truly fixing that requires
  *raising* the session-route IP threshold = a new limiter export + a ~84-test-file mock sweep + a flood-
  posture loosening. Tracked as **F1**, not silently claimed.
- **Off-Vercel precision (round-2 audit nit, carried):** the bucket value is a server-derived DB uuid;
  on the deploy target Vercel overwrites inbound XFF so `getClientIp` cannot return attacker-chosen content.
  Off-Vercel, a spoofed `XFF: uid:<victim-uuid>` would land in the victim's identity bucket (account-
  targeted, not IP-pool-targeted) — bounded: closed on the deploy target, the uuid is non-peer-observable,
  impact ceiling is a fail-open 429 nuisance, not funds or authn.

## Audit chain (all gates green)

| Gate | Result |
|------|--------|
| Pre-build R1 (`wf_2e9f3da8-3bc`, 20 agents) | PLAN_NEEDS_FIXES → 2 tsc-proven blockers (mfa hoist-less try; `tools/[id]/health` optional-auth) → all fixes applied |
| Pre-build R2 (`wf_c31c609b-9c8`) | **PLAN_READY (0 blocking)**; degraded-run guard passed |
| Machine gates G1–G6 (`.audit/n-postbuild/g1-g6-gates.txt`) | G1 `:uid:`==122 · G2 file-set==Appendix A (95), health==0 · G3 diff confined to 95 routes+5 test files · G4 insert-only (mfa sole 1 deletion) · G5 `const userRl`==122 · G6 suites |
| Suites | apps/web **tsc 0 · vitest 4256/0/180 · next build 0 · eslint changed 0**; packages/mcp untouched **1896/1** |
| Post-build panel (`wf_b2d4fc12-a49`, `.audit/n-postbuild/panel-verdict.txt`) | **PASS / 0 blocking / 0 findings**; 4 lenses (insert-only-diff, spine-adjacency, key/limiter correctness, test-integrity); degraded-run guard passed |
| Certification (`wf_a25ba5eb-843`, `.audit/n-certify/cert-verdict.txt`) | **CERTIFIED / 0 confirmed defects**; 7 lenses + critic (gaps:[]); all findings `info` (doc-phrasing/positive). Synthesizer hit the account session limit → synthesis completed inline from cached worker outputs (provenance recorded in the verdict). |

**Certification info-notes (no code change):** (1) "ipAddress captures" = 9 repo-wide (incl.
`app/auth/callback:203`) / 8 under `app/api/` — both correct under scope; byte-stability holds (zero
ipAddress lines in the diff). (2) Plan §7 G5's `rg -c '\buserRl\b' … == 122` literal actually sums to 244
(`userRl` spans 2 lines/site); the real invariant — 122 inserted blocks — holds via `rg -o 'const userRl'
== 122`, which is the form the recorded gates file used.

## Deferred follow-ups (tracked in the DEBT register)

- **F1 — NAT-fairness IP raise (deferred):** raising the session-route IP threshold so one NAT egress isn't
  collectively throttled. Costed: new limiter export → ~84-test-file mock sweep + a deliberate flood-posture
  loosening. Do as its own chunk if NAT throttling is observed.
- **F2 — `sdk/meter` body.consumerId (observation, UNTOUCHED):** `sdk/meter:108` keys its tiered limit on
  client-supplied `body.consumerId` (schema-validated uuid, not matched to the key before the limit call;
  isTestKey re-verifies only in test mode). Bounded by the 1000/min IP layer. A settlement-surface item —
  needs its own trace + funds-aware chunk.
- **F3 — dead `requireApiKey` export (hygiene):** `lib/middleware/auth.ts:155 requireApiKey` has zero route
  callers (the `proxy/[slug]:93` comment references it as a contrast). Removal is a separate decision.

## Real-money discipline

No push, no prod env change, no migration (all founder-gated). The change is off the funds spine — G3
proves no settlement-spine / rails / SDK / cron / health / `packages/mcp` / `lib/rate-limit.ts` /
`lib/middleware/auth.ts` file is in the diff.
