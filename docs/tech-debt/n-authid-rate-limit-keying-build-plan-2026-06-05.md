# (N) Build plan — authenticated-route `auth.id` rate-limit keying (DEBT #1c) — 2026-06-05

> **Status: v2 FINAL — PLAN_READY (0 blocking). Implementation authorized.**
> Round 1: PLAN_NEEDS_FIXES (`wf_2e9f3da8-3bc`, 20 agents, 15 findings → 11 real → 2 blocking; fixes
> applied). Round 2: **PLAN_READY** (`wf_c31c609b-9c8`, resumed after 1 transient subagent death;
> 4 lenses → 4 findings → 1 real nit, 0 blocking; FIX-A execution-proven via tsc on the real file,
> FIX-B proven via swallowed-catch detector over all 95 files). Verdicts:
> `.audit/n-prebuild/round{1,2}-verdict.txt`.
> Chunk picked by the founder at Step-0 (2026-06-05). Founder decisions locked:
> **(D1) scope = session-auth routes only** (settlement rails / SDK paths / `proxy/[slug]` explicitly OUT);
> **(D2) the per-user layer reuses the handler's existing limiter** (founder picked "reuse apiLimiter
> (100/min/user)"; generalized to same-limiter-as-IP-layer, which is `apiLimiter` everywhere except
> `tools/claim` → `authLimiter`). No new limiter, no new export, no new tunable number.
>
> Baselines at HEAD `9b4dfb56` (origin/main `9d22fd2e` + 2 doc commits) — ALL GREEN, re-verified this
> session: apps/web `tsc 0` · `vitest 4250 pass / 0 fail / 179 files` · `next build 0`; packages/mcp
> `vitest 1896 pass / 1 skip`. ANY red after this chunk is this chunk's.

---

## 1. Goal + honest value framing

**DEBT #1 (HIGH, register `publisher-api-keys-audit-2026-05-28.md`) sub-part (c)** — the last open piece:
*"for authenticated routes, key the rate limit on `auth.id` after auth."* H1 closed (a) fail-open;
M closed (b) platform-trusted IP via `getClientIp`. This chunk adds a **post-auth, identity-keyed
rate-limit layer** to every session-authenticated rate-limited route (the two-layer model).

**What this fixes:** a distributed authenticated abuser (many source IPs, one account) is today capped
only per-IP — they dodge the cap by rotating IPs. After this chunk they are capped per-identity
(per handler-prefix), regardless of IP spread. It also gives per-user accountability symmetric with the
SDK surface (which already keys its tiered layer on `consumerId`).

**What this deliberately does NOT fix (honest framing):** shared-NAT collective throttling — the
pre-auth IP layer stays at its current numbers (untouched), so an aggregate >100/min from one NAT egress
IP still 429s pre-auth. Truly fixing that requires *raising* the session-route IP threshold = a new
limiter export → a ~84-test-file mock sweep (the M lesson) + a deliberate flood-posture loosening.
Recorded as deferred follow-up **F1** (§10), not silently claimed.

---

## 2. Verified ground state (all re-derived this session, 2026-06-05)

- `lib/rate-limit.ts` (BYTE-STABLE this chunk): `checkRateLimit(limiter, identifier, options?)` :48-76
  (H1 fail-open default); `apiLimiter` 100/min :97; `authLimiter` 5/min :94; `sdkLimiter` 1000/min :100;
  `checkTieredRateLimit` :146-174; `getClientIp` :194-203.
- `lib/middleware/auth.ts` (BYTE-STABLE): `requireDeveloper` :52-99 → `{id: developers.id, email}`;
  `requireConsumer` :105-150 → `{id: consumers.id, email}`; `requireApiKey` :155-200 → **zero real route
  callers** (the one census match was a *comment* in `proxy/[slug]/route.ts:93`).
- Route-local guards: `tools/publish/route.ts:149-184` `authenticateDeveloperByApiKey` → `{id: developers.id,
  email}` (x-api-key → `developerApiKeys` join); `admin/signup-followup/route.ts:89-116` local `requireAdmin`
  = IP-rl → `requireDeveloper` → `ADMIN_EMAILS` gate, returns `{ok, auth}` — its ONE `requireDeveloper` call
  serves both GET+POST handlers.
- Admin routes generally = `requireDeveloper` + in-handler `ADMIN_EMAILS` check (e.g. `admin/metrics:20,42`).
  Identity is still `developers.id`.
- **Dominant shape (V1):** `const ip = getClientIp(request.headers)` → `checkRateLimit(<limiter>,
  \`<prefix>:${ip}\`)` → 429 → auth guard → handler body. Two V1 sub-shapes (both type-clean at the
  insert point because the auth var is in scope after the guard succeeds):
  - **V1a (dominant):** `let auth; try { auth = await requireX(request) } catch → 401` — `auth` is
    HOISTED before the try, so `auth.id` is dereferenceable after the try/catch (baseline tsc 0 proves it).
  - **V1b (bare guard, 4 sites / 2 files):** `const consumer = await requireConsumer(request)` with NO
    dedicated try/catch — the guard's throw propagates to the handler's outer catch → 401
    (`consumer/schedules/route.ts:99,:139`; `consumer/schedules/[id]/route.ts:24,:71`). Insert
    immediately after the guard line.
  Two guard-shapes do NOT fit V1 and are handled explicitly: `auth/mfa/route.ts:67` (bare un-assigned
  call inside a hoist-less try — class X1, §4) and `tools/[id]/health/route.ts:43` (optional-auth,
  `const auth` inside a swallowed-catch try — EXCLUDED, §3). The round-1 audit verified these are the
  ONLY two deviating guard sites in the tree.
- **orgs/* (5 files)** run auth FIRST, then the IP limit (e.g. `orgs/route.ts:34→37`) — post-auth class V2.
- The handoff's `authenticateDeveloperByApiKey`-as-shared-guard and `requireAdmin`-as-shared-guard labels
  were drift; corrected above. The handoff's "~96 incl. sdk/meter*, sessions/*, settlements/[id]" scope
  fear was drift: those routes have **no session identity** (sessions/* is unauthenticated by design —
  `sessions/route.ts:2`; rails authenticate by payment credential) or **already key identity**
  (`sdk/validate-key:101`, `sdk/meter:108` tiered on consumerId).

## 3. The census (re-derive, do not trust)

**95 route files / 122 insertion sites.** Derivation (exact greps):

```
ROOT=apps/web/src/app/api
rg -l 'checkRateLimit\(|checkTieredRateLimit\(' $ROOT -g 'route.ts' | sort > rl.txt          # 212
rg -l 'requireDeveloper\(|requireConsumer\(' $ROOT -g 'route.ts' | sort > sess.txt           # 95
comm -12 rl.txt sess.txt                                                                      # 95
+ tools/publish/route.ts (authenticateDeveloperByApiKey call :214)                            # 96
− tools/[id]/health/route.ts (optional-auth EXCLUSION, below)                                 # = 95
```
- Call-paren regexes kill the two false positives a bare-name grep produces (`proxy/[slug]` comment;
  none other). `proxy/[slug]` is OUT (inline x-api-key, settlement-trigger, D1).
- **⚠️ EXCLUSION (round-1 audit blocking #2): `tools/[id]/health/route.ts`.** Its guard is
  OPTIONAL-auth (`:41-47`: `let isOwner = false; try { const auth = await requireDeveloper(request);
  isOwner = … } catch { /* public view */ }` — swallowed catch, public fallthrough at `:88`). A uid
  layer here is **anonymous-bypassable** (an abuser simply omits credentials and takes the public path),
  so it adds zero abuse resistance and can ONLY additionally throttle the legit authenticated owner
  (e.g. dashboard health polling across many owned tools). DEBT #1c targets *authenticated* routes;
  this is a public route with optional enrichment. It stays **IP-only** (its existing `tool-health:${ip}`
  layer at `:21` is untouched). The audit verified `:43` is the SOLE optional-auth guard site in the
  tree (1 of 1), so this is a clean single carve-out.
- **Insertion sites = guard CALL sites = 122**: 121 assigned (`auth` ×110, `developer` ×7, `consumer` ×4)
  + 1 bare (`auth/mfa/route.ts:67`). (A raw guard-regex count over the 95 files says 123; −1 for the
  publish function-definition line :149.) Zero dual-guard files. Zero guarded-but-unlimited handlers
  (every guard site's handler/helper has its own IP layer).
- Per-site classes: **V1 ×112** (standard pre-auth; V1a hoisted-`let` ×108 + V1b bare-guard ×4) ·
  **V2 ×7** (orgs post-auth: `orgs/route.ts` 1, `orgs/[id]/route.ts` 2, `orgs/[id]/members/route.ts` 2,
  `orgs/[id]/members/[userId]/route.ts` 1, `orgs/[id]/allocations/route.ts` 1) · **V3 ×1**
  (signup-followup helper) · **V4 ×1** (publish PUT) · **X1 ×1** (mfa:67 bare call). 112+7+1+1+1 = 122.
- Limiter variance: `apiLimiter` in 94 files; `authLimiter` only `tools/claim/route.ts:60`.
  `checkTieredRateLimit` appears in ZERO census files.
- Full 95-file list: Appendix A.

## 4. The design (rules R1-R8)

**R1 — what is inserted (the uid block).** In each of the 122 sites, immediately after auth-success,
insert (mirroring the handler's existing style — `rl`-style shown):

```ts
const userRl = await checkRateLimit(<sameLimiter>, `<samePrefix>:uid:${<authVar>.id}`)
if (!userRl.success) {
  return errorResponse(<byte-identical args to the handler's existing IP-layer 429 return>)
}
```

**R2 — key scheme.** `<samePrefix>` is the literal prefix segment(s) of the SAME handler's IP-layer
identifier — everything up to and including the colon before the FIRST `${…}` interpolation. (2 sites
interpolate `${ip.split(',')[0]?.trim() ?? 'unknown'}` rather than `${ip}` —
`admin/chargeback-watch/unpause/route.ts:49` prefix `chargeback-unpause:` and
`payouts/schedule/route.ts:84` prefix `payout-schedule:` — the rule covers them identically; the
single-writer reads each line, no mechanical string-match is relied on.) Collision-freedom of
`…:uid:<id>` vs `…:<ip>` rests on (i) the `uid:` infix — the `:uid:` namespace is unused anywhere in
src today — and (ii) the SETTLED Vercel trust model (`rate-limit.ts:178-189`): Vercel overwrites
inbound XFF, so on the deploy target `getClientIp` cannot return attacker-chosen content (e.g. a
spoofed `uid:<victim-uuid>` string). Off-Vercel that property degrades exactly as documented for the
IP layer in M/H1 (anti-abuse, fail-open, not authn) — with one precision (round-2 audit nit): there a
spoofed `XFF: uid:<victim-uuid>` would land in the victim's identity bucket, making the pre-drain
ACCOUNT-targeted rather than IP-pool-targeted. Bounded: the vector is closed on the deploy target
(Vercel overwrites XFF), the uuid is non-peer-observable (no census response exposes another account's
developer/consumer id), and the impact ceiling is a fail-open 429 nuisance — not funds or authn.
The bucket value is a server-derived DB uuid (session→DB row or key-hash→DB row): stable per identity
and not client-suppliable on the deploy target. Per-handler buckets, same as the IP layer's
per-handler semantics.

**R3 — limiter.** The SAME limiter instance the handler's IP layer uses (D2): `apiLimiter` everywhere
except `tools/claim` (`authLimiter`, 5/min/user — proportionate for a claim flow). Zero import changes
(by construction the file already imports it). `lib/rate-limit.ts` is NOT touched — no new export, no
helper; the convention lives in this plan + the inserted code.

**R4 — placement per class.**
- V1: immediately after the auth call SUCCEEDS, before any authorization/tier/body/db work. For V1a
  (hoisted `let auth … try/catch`): first statement after the try/catch block. For V1b (bare guard,
  the 4 consumer/schedules sites): first statement after the bare guard line (its throw propagates to
  the outer catch → 401; the auth var is in scope on the success path either way).
- V2 (orgs): first statement after the EXISTING post-auth IP-rl block (keeps that block contiguous).
- V3 (signup-followup): inside the local `requireAdmin` helper, after the `requireDeveloper` try/catch
  succeeds (before the `ADMIN_EMAILS` check) — one insert covers GET+POST; same `{ok:false, response}`
  return shape as the helper's existing 429 arm.
- V4 (publish): after the `authenticateDeveloperByApiKey` try/catch (auth :212-220), before `parseBody`.
- X1 (mfa POST :66-70 — round-1 audit blocking #1): the POST handler's try has NO hoisted `let auth`
  (unlike GET/PUT/DELETE in the same file), so a `const auth =` ON line 67 would be block-scoped inside
  the try and invisible to a post-try insert (tsc-proven TS2304). The X1 transform is therefore:
  (a) INSERT `let auth` on its own line immediately before the `try` at :66 (pure insertion, mirrors
  the file's own GET :21 / PUT :107 / DELETE :171 hoists); (b) CHANGE :67 `await requireDeveloper(request)`
  → `auth = await requireDeveloper(request)` (the chunk's single modified line); (c) standard V1a insert
  after the try/catch. The file's other 3 sites are V1a.

**R5 — 429 response.** Byte-mirror the handler's existing IP-layer 429: same response helper, message,
status, code, and `requestId` argument presence. No new message strings beyond what each handler already
uses. (Routes do not forward rate-limit headers today; none added.)

**R6 — insert-only invariant.** The production-code sweep is PURE INSERTION except the single X1
modified line: `git diff --numstat` over the 95 census files must show deletions == 0 for 94 files and
exactly 1 for `auth/mfa/route.ts` (the :67 content change; the `let auth` hoist and every uid block are
pure insertions). Nothing else in any census file changes (prefixes — including the 2 split-interpolation
identifiers named in R2, kept byte-identical in the IP layer — limiters, messages, ordering,
`maxDuration`, imports — all byte-stable).

**R7 — failure semantics.** No `options` passed → H1 fail-open default, identical to every existing call.
A rate-limit store failure cannot take authed routes down (posture unchanged).

**R8 — multi-handler files.** Apply per guard site (per handler), not per file. Multi-site files:
`auth/mfa` ×4 (3×V1 + X1), `tools/[id]` ×3, `developer/tools/[id]/endpoint` ×3, and the ×2 files from the
census table; each handler keeps its own prefix.

## 5. Behavioral deltas (enumerated — nothing silent)

- **Δ1** Authenticated callers exceeding `<limit>/min/user` on a single handler now 429 post-auth (new
  protection; previously unlimited per-identity if IPs rotate). Legit dashboard users are far below
  100/min on any single endpoint; the audit must hunt for any client-side polling loop that could hit
  one census endpoint >1.6 req/s sustained per user.
- **Δ2** +1 Upstash `limit()` call per authed request on these handlers (~2× rate-limit command volume on
  dashboard traffic; cost trivial at current scale — deliberate).
- **Δ3** +1 Redis RTT latency per authed request (single-digit ms; deliberate).
- **Δ4** Unauthenticated / failed-auth request paths are byte-identical (the uid check runs only after
  auth success; auth failures still consume only the IP bucket).
- **Δ5** A user-layer 429 is shape-identical to the existing IP-layer 429 of the same handler (deliberate).
- **Δ6** NAT-starvation direction unchanged (§1 honest framing; F1).

## 6. Tests

**Forced edits to existing tests: ZERO.** Evidence (alias-aware, corrected in round 1):
- **Call-count/Nth assertions: none.** Alias-aware sweep (`mockCheckRateLimit`/`vi.mocked(checkRateLimit)`
  aliases included): zero `toHaveBeenCalledTimes`/`toHaveBeenNthCalledWith`/`mock.calls.length`
  assertions on `checkRateLimit` anywhere. (Arg-assertions DO exist via the hoisted alias
  `mockCheckRateLimit` — e.g. census route `tools/[id]/listed-in-marketplace/__tests__/route.test.ts:136,:155`
  — but they are `toHaveBeenCalledWith`, which is additive-safe: it asserts "was called with", not
  "was only called with", so an extra uid call cannot break it.)
- **Call-order-sensitive mocks are uniformly safe.** ~40+ census-route tests use
  `mockResolvedValueOnce({success: false})` for their 429-path tests (e.g. orgs:197, tools:578,
  audit-log:241, billing-subscribe-tax:318). Every one is `success: false` → it trips the FIRST
  (IP-layer) call → 429 returns pre-auth → the new uid call never executes in those tests. There are
  ZERO `mockResolvedValueOnce({success: true})` (or `mockImplementationOnce`) mocks on `checkRateLimit`
  in the tree — the danger case (a once-mock exhausting so the SECOND call returns `undefined` →
  `userRl.success` TypeError) has no instances. Base mocks all return blanket success.
- The 84 files mocking `@/lib/rate-limit` already stub `checkRateLimit` + the limiter objects the routes
  import — no mock additions (this is why D2/R3 avoid any new export).

**New tests: +6** (placed in the existing test file already covering each route — locate via
`rg -l '<route path>' apps/web/src/**/__tests__`; if a route has none, a new `n-uid-rate-limit.test.ts`):
- T1 V1/developer (a payouts route): 1st `checkRateLimit` → success, 2nd → fail ⇒ expect 429 AND
  `toHaveBeenNthCalledWith(2, expect.anything(), '<prefix>:uid:<mocked dev id>')`.
- T2 V1/consumer (`consumer/balance`): same shape, consumer id.
- T3 V2 (`orgs` create POST): same shape post-auth.
- T4 V4 (`tools/publish` PUT): same shape, dev-key identity id.
- T5 X1 (`auth/mfa` POST handler): proves the hoist+capture + uid key. NOTE: `auth/mfa` has NO existing
  test file (verified round 1) — T5 is the one test that takes the fallback `n-uid-rate-limit.test.ts`
  path: stub `@/lib/rate-limit` blanket-success (+ `apiLimiter` export), mock `requireDeveloper` to a
  fixed dev id, mock the supabase MFA client module the route imports.
- T6 negative (same route as T1): auth guard rejects ⇒ `checkRateLimit` called exactly ONCE (uid layer
  never runs on failed auth).

**Expected end state:** apps/web `vitest 4256±0 pass / 0 fail` (4250 + 6) · `tsc 0` · `eslint <changed> 0`
· `next build 0`; packages/mcp UNTOUCHED `1896/1`.

## 7. Done-check gates (machine gate — all must pass before the post-build panel)

- **G1** `rg -o ':uid:\$\{' apps/web/src/app/api -g 'route.ts' | wc -l` == **122**.
- **G2** Every Appendix-A file ≥1 `:uid:` match; every NON-census `route.ts` == 0 matches (incl. the
  excluded `tools/[id]/health/route.ts`).
- **G3** `git diff --name-only` ⊆ {95 census files} ∪ {test files} ∪ {docs}. Explicitly ABSENT:
  `lib/rate-limit.ts`, `lib/middleware/auth.ts`, anything under `lib/settlement/`, `sdk/`, `x402/`,
  `ap2/`, `circle-nano/`, `sessions/`, `outcomes/`, `settlements/`, `proxy/[slug]`, `cron/`,
  `tools/[id]/health`, packages/mcp.
- **G4** `git diff --numstat` (census files): deletions 0 ×94; `auth/mfa/route.ts` deletions exactly 1.
- **G5** `rg -c '\buserRl\b' apps/web/src/app/api` summed == 122 (each insert uses the collision-free name);
  every match file ∈ Appendix A.
- **G6** Full gates green at §6's expected end state.

## 8. ⚠️ SCOPE GUARD (over-auditing clause — embed in both audit gates)

Objective confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows scope
is `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong. Named
growth vectors to HOLD THE LINE against:
- touching the SDK paths, settlement rails, `proxy/[slug]`, or `cron/*` in any way (incl. "fix
  `sdk/meter`'s body.consumerId tiered key" — recorded as F2, a future chunk);
- raising/lowering/adding/removing ANY limit or limiter number (incl. "mfa should use authLimiter",
  "claim's 5/min is odd", "orgs lack a pre-auth IP layer", the F1 NAT raise);
- new exports/helpers/wrappers in `lib/rate-limit.ts` or `auth.ts`; tier-aware user limits; global
  (cross-handler) user buckets; prefix renames; 429-message normalization; adding requestId to handlers
  lacking it; "fix orgs' auth-error→outer-catch response shape";
- migrating any `ipAddress:` audit capture; re-litigating H1/M settled items (fail-open, left-most-XFF,
  `'unknown-ip'`, the 9 audit captures) or §1-settled spine semantics without a NEW trace.
SETTLED list carried from the handoff §1 (settlement spine, take model, B4, balanceCents, dedup,
exactly-once, getClientIp posture).

## 9. Rollout (single-writer)

1. Directory batches: admin → audit-log/auth → billing → consumer → dashboard → developer → orgs →
   payouts/proxy-stats/stripe → templates → tools. Manual, file-by-file (variance is real: var names,
   prefixes, response styles); `tsc --noEmit` spot-checks between batches; full gates at the end.
2. The 6 new tests, then G1-G6, then full §6 gates.
3. **Post-build gate (mandatory, 0 blocking):** security/regression panel (adapt
   `.audit/m-postbuild/security-panel.mjs`) with an **insert-only diff lens** (machine: G4) + a
   spine-adjacency lens over the money-adjacent census routes (payouts ×3, billing ×5, stripe/connect,
   templates/purchase, consumer/credit-packs ×2, tools/publish — plus, belt-and-suspenders per the
   round-2 audit: the 5 orgs/* files (import `lib/settlement/{organizations,rbac}.ts`) and the 2
   data-export files (import `lib/settlement/compliance.ts`); the binding guarantee remains machine
   gate G3) verifying each diff hunk is exactly a uid block. Chunk is OFF the funds spine (G3 proves no spine file in diff) → panel, not funds-SEAL.
4. Founder-gated LOCAL commit (path-scoped `git commit -- <paths>`; quote `[slug]`/`[id]` paths). NO push.
5. Close-out: capstone doc, DEBT register #1c → CLOSED (+F1/F2/F3 entries), memory update.

## 10. Register updates shipped with this chunk (docs only)

- **F1 (deferred):** NAT-fairness IP-raise on session routes — costed: new limiter export → ~84-test-file
  mock sweep + deliberate flood-posture loosening; do as its own chunk if NAT throttling is observed.
- **F2 (observation, settlement surface, UNTOUCHED):** `sdk/meter:108` keys its tiered limit on
  client-supplied `body.consumerId` (schema-validated uuid, but not matched to the key before :108;
  the isTestKey branch re-verifies only in test mode). Bounded by the 1000/min IP layer. Needs its own
  trace + funds-aware chunk.
- **F3 (hygiene candidate):** `lib/middleware/auth.ts:155 requireApiKey` has zero route callers — dead
  export (the proxy comment :93 references it as a contrast). Removal is a separate decision.

## Appendix A — the 95-file census (relative to `apps/web/src/app/api/`)
<!-- tools/[id]/health/route.ts EXCLUDED per §3 (optional-auth; stays IP-only) -->

```
admin/chargeback-watch/unpause/route.ts
admin/funnel/route.ts
admin/kernel-health/route.ts
admin/launch-metrics/route.ts
admin/metrics/route.ts
admin/reviews/[id]/route.ts
admin/reviews/route.ts
admin/signup-followup/route.ts
admin/stats/route.ts
audit-log/export/route.ts
audit-log/route.ts
auth/consumer/me/route.ts
auth/developer/me/route.ts
auth/mfa/route.ts
billing/change-plan/route.ts
billing/checkout/route.ts
billing/manage/route.ts
billing/purchases/route.ts
billing/subscribe/route.ts
consumer/alerts/[id]/route.ts
consumer/alerts/route.ts
consumer/balance/route.ts
consumer/budget/route.ts
consumer/conversion-events/route.ts
consumer/credit-packs/auto-refill/route.ts
consumer/credit-packs/route.ts
consumer/explorer/route.ts
consumer/keys/[id]/ip-restrict/route.ts
consumer/keys/[id]/route.ts
consumer/keys/route.ts
consumer/purchases/route.ts
consumer/referral/apply/route.ts
consumer/referral/route.ts
consumer/schedules/[id]/route.ts
consumer/schedules/route.ts
consumer/subscriptions/route.ts
consumer/usage/analytics/route.ts
consumer/usage/route.ts
dashboard/developer/api-keys/[id]/route.ts
dashboard/developer/api-keys/route.ts
dashboard/developer/benchmarks/route.ts
dashboard/developer/consumers/insights/route.ts
dashboard/developer/data-export/[id]/route.ts
dashboard/developer/data-export/route.ts
dashboard/developer/fraud/signals/route.ts
dashboard/developer/notification-preferences/route.ts
dashboard/developer/payout-settings/route.ts
dashboard/developer/profile/route.ts
dashboard/developer/reviews/[id]/flag/route.ts
dashboard/developer/reviews/[id]/respond/route.ts
dashboard/developer/reviews/route.ts
dashboard/developer/security-status/route.ts
dashboard/developer/stats/advanced/route.ts
dashboard/developer/stats/analytics/route.ts
dashboard/developer/stats/attribution/route.ts
dashboard/developer/stats/export/route.ts
dashboard/developer/stats/forecast/route.ts
dashboard/developer/stats/funnel/route.ts
dashboard/developer/stats/route.ts
dashboard/developer/usage/route.ts
developer/achievements/route.ts
developer/invite/route.ts
developer/notifications/configure/route.ts
developer/referrals/[id]/earnings/route.ts
developer/referrals/[id]/route.ts
developer/referrals/route.ts
developer/tools/[id]/endpoint/route.ts
developer/webhooks/[id]/deliveries/route.ts
developer/webhooks/[id]/route.ts
developer/webhooks/[id]/test/route.ts
developer/webhooks/route.ts
orgs/[id]/allocations/route.ts
orgs/[id]/members/[userId]/route.ts
orgs/[id]/members/route.ts
orgs/[id]/route.ts
orgs/route.ts
payouts/route.ts
payouts/schedule/route.ts
payouts/trigger/route.ts
proxy/stats/route.ts
stripe/connect/route.ts
templates/[slug]/download/route.ts
templates/purchase/route.ts
tools/[id]/changelog/route.ts
tools/[id]/listed-in-marketplace/route.ts
tools/[id]/pricing-simulator/route.ts
tools/[id]/report/route.ts
tools/[id]/route.ts
tools/[id]/status/route.ts
tools/[id]/version/route.ts
tools/by-slug/[slug]/reviews/route.ts
tools/claim/route.ts
tools/publish/route.ts
tools/quick-publish/route.ts
tools/route.ts
```
