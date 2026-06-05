# H1 — rate-limit availability hardening + processDataDeletion idempotency — RESOLUTION (2026-06-05)

> Capstone for the H1 chunk (the first post-B4, Step-0-gated, OFF-funds-spine chunk).
> Build plan: `h1-rate-limit-availability-build-plan-2026-06-05.md` (PLAN_READY, round 1, 0 blocking).
> Post-build security/regression panel: **PASS (0 blocking / 0 findings)** — the funds-SEAL
> substitute for off-spine chunks per handoff §7.

## 1. Step-0 record (founder decisions, 2026-06-04)

From the post-B4 fork (`next-chunk-handoff-2026-06-04-post-b4.md` §3), the founder picked
**(R) rate-limit availability surgical core + (D) processDataDeletion fix, BUNDLED**, with
fail-mode policy **fail-open + alert on ALL routes** (optional `failMode` hook ships unused).
Non-picks: (A) ACP-dark (BD-gated), (H) hop-route (demand-gated, reconciler-starvation trap),
(C) revenueSharePct (lower value-per-risk).

## 2. Three handoff corrections found during grounding (the record)

1. **`ephemeralCache` was already ON.** `@upstash/ratelimit` v2.0.8 exports
   `RegionRatelimit as Ratelimit`; the base constructor defaults
   `ephemeralCache === undefined` → `new Cache(new Map())`. The handoff's "no
   ephemeralCache" claim was false; that scope item was dropped as moot.
2. **The throw window is the REJECTION path only.** v2 races `limit()` against a built-in
   5s timeout that resolves `success:true` — hangs already failed open. The unguarded
   failure mode was a store *rejection* (connection refused / DNS / auth / 5xx / missing
   env) throwing through `checkRateLimit` → every limited route 500s. That is what H1 fixed.
3. **Left-most XFF is NOT spoofable on the deploy target.** Official Vercel docs
   (`vercel.com/docs/headers/request-headers`): Vercel **overwrites** inbound
   `x-forwarded-for` and "do[es] not forward external IPs … to prevent IP spoofing";
   `x-real-ip` is documented identical; custom XFF passthrough is Enterprise "Trusted
   Proxy". The handoff's "rightmost-XFF" fix direction would have been wrong on Vercel.
   The in-repo P4.K1 trust model was correct all along; the helper is consistency +
   portability hygiene, not a vulnerability fix.

## 3. What shipped

**R1 — central fail-mode (`lib/rate-limit.ts`).** `checkRateLimit` try/catches the store
call: on rejection it logs `logger.error('rate_limit.fail_open'|'rate_limit.fail_closed',
{ identifier, error })` and returns `{ success: failMode==='open', limit:0, remaining:0,
reset:0 }` (mirrors Upstash's own timeout-response shape). Optional third param
`{ failMode?: 'open'|'closed' }`, default `'open'`; **no caller passes it** — hook only.
`checkTieredRateLimit` gained the same fail-open around its eager `createRateLimiter`
call (env-throw path); nothing cached on failure (next call retries).

**R2 — shared trusted-IP helper.** `getClientIp(headers)` promoted to `rate-limit.ts` as
the single source of truth (left-most XFF → `x-real-ip` → `'unknown-ip'`, full Vercel
trust-model docstring); `demo-rate-limit.ts` re-exports it as `extractClientIp`
(back-compat; its 7 P4.K1 tests pass UNEDITED) and `checkDemoRateLimit` calls it directly.

**R3 — three previously-unlimited public routes gated (IP-keyed):**
| Route | Limiter | Identifier | Placement |
|---|---|---|---|
| `api/tools/serve/[slug]` (GET+POST) | sdkLimiter 1000/min/IP | `tools-serve:<ip>` | AFTER health fast-path, BEFORE handler lookup (health stays limit-free) |
| `api/unsubscribe` (GET+POST) | authLimiter 5/min/IP | `unsubscribe:<ip>` | First statement in both try blocks (caps the permanent no-TTL key flood) |
| `api/mcp` (POST+DELETE via `handleMcp`) | sdkLimiter 1000/min/IP | `mcp:<ip>` | First statement, BEFORE McpServer/transport construction; 429 = JSON-RPC `-32000` + CORS. OPTIONS/GET deliberately limit-free |

The handoff's "does mcp inherit?" question was answered NO: its `call_tool` fallback
fetches the (previously unprotected) serve route via the absolute public URL, arriving
with the function egress IP — all MCP users would pool into one shared bucket. Direct
limit required.

**D — `processDataDeletion` status machine (`lib/settlement/compliance.ts`).**
`pending → processing → completed | failed`; `completed` re-run = idempotent no-op
(+ `compliance.data_deletion_already_completed` info log); `failed` = RETRYABLE
(safety proof: all anonymization writes commit atomically in one txn whose step 9 sets
`completed` INSIDE it; the catch sets `failed` without rethrow ⇒ `failed` ⇒ the txn never
committed ⇒ retry sees pristine data); `processing` = concurrency guard (throws).
Root cause of the perennial baseline test fail: the settlement-moat schema mock omitted
`developerApiKeys` while impl step 1b dereferences it → TypeError → caught → `'failed'`.
One mock key + the guard rewrite fixed both halves of DEBT #5's idempotency claim.

**Tests:** +25 net new/converted across 7 files (3 new route suites; rate-limit fail-mode
+ getClientIp delta units; tiered creation-throw; settlement-moat rig-hoist + no-op +
failed-retry + processing-guard pins, incl. a `tx.delete`-count pin so the schema mock
can't silently drift again).

## 4. Verification + audit chain

| Gate | Result |
|---|---|
| Pre-build audit (4 lenses → adversarial verify → synthesis) | **PLAN_READY round 1, 0 blocking** (10 findings: 4 plan-text nits applied, 6 refuted) — `.audit/h1-prebuild/round1-verdict.txt` (local) |
| apps/web `tsc --noEmit` | 0 |
| apps/web `vitest run` | **4248 pass / 0 failed / 179 files** (baseline was 4222/1 — the perennial `processDataDeletion` red is GONE; future SEALs run fully green) |
| `eslint` (all 12 changed files) | 0 |
| `next build` | 0 |
| packages/mcp `vitest run` | 1896 pass / 1 skip (untouched; no SDK rebuild) |
| Post-build security/regression panel (5 lenses + adversarial verify) | **PASS, 0 blocking / 0 findings** — `.audit/h1-postbuild/panel-verdict.txt` (local) |

No migration. No schema change. No funds-spine file touched except `compliance.ts`'s
status-guard region + docstring (panel-verified byte-stable txn body + retention list).

## 5. Follow-ons (documented, deliberately NOT this chunk)

> **Items 1 + 2 RESOLVED 2026-06-05** by the (M)+(E) chunk — the `getClientIp` call-site migration (208
> files) + the `processDataExport` symmetric guard both shipped (pre-build PLAN_READY + post-build panel
> PASS/0-blocking). See `m-getclientip-migration-resolution-2026-06-05.md`. Item 3 (crashed-`processing`
> runbook note) is unchanged; `auth.id` keying remains a separate deferred item.

1. **The ~218-caller `getClientIp` migration** (DEBT #1 residual): existing call sites
   read XFF in two styles; on Vercel both resolve identically (correction #3), so this is
   consistency hygiene, not a vuln. Mechanical sweep; large blast radius; do as its own
   audited chunk if/when wanted. Authenticated routes could also key on `auth.id`
   post-auth (register sketch (c)).
2. **`processDataExport` symmetric guard** (`compliance.ts:278-280`): same
   `status !== 'pending'` wedge pattern as the old deletion guard. Observed, untouched
   (scope guard). Same fix shape applies.
3. **Crashed-`'processing'` deletion runbook note:** a run that dies between the
   `processing` flip and the txn (or crashes mid-txn) leaves status `'processing'`
   forever; the H1 guard throws on re-run. OPERATOR ACTION: verify no run is in flight,
   then manually reset the row to `'pending'`
   (`UPDATE compliance_exports SET status='pending' WHERE id='<exportId>'`) and re-invoke.
4. **DEBT #5's second sub-claim is STALE:** the register said the consumer
   cross-anonymize "uses the post-rewrite developer email" — false at current code: the
   developer email is captured PRE-transaction (`compliance.ts` dev lookup, before step 1
   rewrites it) and step 2 uses that captured value. Verified 2026-06-05; recorded in the
   register UPDATE.
5. **Fail-closed adoption** for any future sensitive route class: pass
   `{ failMode: 'closed' }` at the call site — the hook ships tested but unused.

## 6. Standing decisions (do not re-litigate)

- Fail-open + alert on ALL routes is the founder-decided posture (2026-06-04); it matches
  the Upstash client's own built-in hang behavior and the P4.K1 demo precedent.
- Left-most-XFF + `x-real-ip` fallback is CORRECT on Vercel (official docs cited in the
  `getClientIp` docstring). Do not "fix" it to rightmost.
- `sdkLimiter` for serve/mcp + `authLimiter` for unsubscribe were deliberate (plan §6
  rationale: MCP shared-egress headroom; strictest-existing for the permanent-key writer).
  No limiter numbers were tuned; no new limiter configs created.
- The settlement spine remains byte-stable; this chunk sets the template for off-spine
  hardening chunks (security/regression panel in place of funds-SEAL).
