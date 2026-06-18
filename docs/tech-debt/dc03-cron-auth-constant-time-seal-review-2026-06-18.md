# DC-03 — cron-auth constant-time compare + secret normalization — ② SEAL-GATING REVIEW (2026-06-18)

> The independent, hostile, fresh-context review that DECIDES the seal. Scope = the BUILT CODE
> diff (not the plan, not the integrated system). Tier = HIGH-STAKES (re-confirmed). Verdict:
> **② CLEAN — recommend SEAL.** Claude cannot self-seal; the operator runs the manual `/seal-go`
> gate. High-stakes ⇒ ③ post-seal deep audit follows (this doc doubles as the ③ handoff, §8).

## 0. Verdict
**CLEAN. Zero high-severity findings, zero medium-severity findings open.** Gate green;
5 lens-distinct fresh-context reviewers converged; integrator independent ground-truth confirms
every load-bearing claim live. The lows are all intended trade-offs, non-exploitable theory,
out-of-scope, or cosmetic (§6). **Recommend the operator run `/seal-go`.**

## 1. Build-evidence disposition — re-run from scratch (the build emitted NONE for DC-03)
The cadence-state JSON body (`result`/`record`/`seal`/`gate`) was **stale DC-18 content** — there
was no DC-03 build self-verification evidence (no gate command + exit code + digest, no build
manifest). Per the ② policy this is an **evidence-free "green" → treated as RED → gate re-run from
scratch** by the integrator in a clean isolated run (`apps/web`):

| Check | Command | Result |
|---|---|---|
| types | `npx tsc --noEmit` | exit 0 — **0 errors** |
| lint | `npm run lint` | **0 errors**, 8 pre-existing warnings (handbook/carousel/SearchBar/TagFilter/logo/academy-lessons test — **none in DC-03 scope**) |
| tests | `npx vitest run` | **199 files / 4596 tests / 0 failed** |

This equals the handoff's predicted baseline (197 files / 4576 tests) **+ exactly the 20 net-new
cron-auth pins** (10 unit in `cron-auth.test.ts` + 10 route-level in `cron-auth-routes.test.ts`) and
+2 files. Gate confirmed green against the realized diff.

## 2. Tier re-confirmation — HIGH-STAKES (held, not lowered)
The realized diff touches the **sole auth gate on 32 endpoints incl. the money rails**
(`settlement-reconcile`, `process-payouts`). Boundary unchanged from the plan; no frozen surface
opened beyond the sanctioned per-route auth blocks. Tier held at high-stakes.

## 3. Review shape — Agent-tool spawns, 5 lenses, coverage mode
Operator opted (this turn) for **Agent-tool spawns** (small focused diff, not a large ③ audit) and
**xhigh** for the crypto core-invariant lens (Path-1 `max` definitions unavailable; the crypto is
the textbook SHA-256-both-sides→timingSafeEqual pattern already 4-lens plan-audited, so a sequential
`/effort max` pass was not warranted). All reviewers pinned `model: opus` (claude-opus-4-8) and ran
read/grep/git-diff only (gate/repro kept integrator-side; **allowlist GREEN**, no new grant needed).

| Lens | Verdict | H | M | Low/info |
|---|---|---|---|---|
| **L1 crypto core-invariant** (timing-safety / auth-bypass / fail-closed) | moat holds; could not exhibit a defect | 0 | 0 | 3 |
| **L2 behavioral-equivalence** (LB-2; 32/32 sites byte-identical) | NO DRIFT; per-site (a)–(f) sweep all negative | 0 | 0 | 1 |
| **L3 spec-conformance** (§4/§4b/§8 + census) | CONFORMANT; census exactly 32; frozen surfaces untouched | 0 | 0 | 2 |
| **L4 literal-execution** (fail-open / missing `return`) | NO fail-open; all 32 sites `return` every non-`ok` enum | 0 | 0 | 0 |
| **L5 SEAM** (SEAM-6 crypto≠Edge + sole-gate + compare-shape) | claims hold; crypto does NOT reach Edge (traced path-by-path) | 0 | 0 | 4 |

All reviewers self-reported `claude-opus-4-8[1m]` / `high`. Opus-4.8 effort self-introspection is
**known-unreliable per policy** (matches the DC-18 ③ precedent); real assurance = 5-lens convergence
+ adversarial framing + integrator independent ground-truth + live premise verification (below).

## 4. Integrator independent ground-truth (not trusting convergence)
1. **No surviving CRON_SECRET inline compare** — repo grep: the only inbound `!==`/token compare is
   `telemetry/kernel` (`KERNEL_TELEMETRY_AUTH_TOKEN` via its own `constantTimeEquals`), the separate
   **out-of-scope** primitive per §3/§8. No CRON_SECRET site missed.
2. **`verifyCronAuth` call sites = exactly 32** (= the §3 census).
3. **`env.ts` untouched** — `getCronSecret` stays raw; no `node:crypto` import; not in git-status.
4. **`middleware.ts` does NOT import `@/lib/cron-auth`** — SEAM-6 holds (crypto ≠ Edge bundle).
5. **settlement-reconcile (money rail)** — no-secret 500 + `cron.settlement_reconcile.no_secret`;
   unauthorized 401 + the **test-pinned `{ ip, userAgent }` log preserved verbatim**; both branches
   `return`; `reconcilePendingSettlements()` only on `auth === 'ok'`. Byte-faithful to §4b.
6. **Seal digest** — `cron-auth.ts` SHA-256 = `3e91f1446ea39f6b88ba60869ae171a8d091354e155ad8ca527aece615b1ccae`.

## 5. Seal subject (the in-scope diff)
- **NEW** `apps/web/src/lib/cron-auth.ts` (shasum above).
- **NEW** `apps/web/src/lib/__tests__/cron-auth.test.ts` (10 unit pins) + `apps/web/src/app/api/__tests__/cron-auth-routes.test.ts` (10 route pins).
- **MODIFIED** 32 route files (28 cron + admin/setup-proxy-endpoints, admin/gridbot, github/scan, indexnow).
- **EXCLUDED** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx` — unrelated uncommitted carry-forward; untouched by this chunk; exclude at founder-close.

## 6. Lows — enumerated + disposition (NONE require a code fix)
- **L1-a / L2 / L3 — symmetric-trim broadening.** `getCronSecret()?.trim()` + `raw.trim()` accepts a
  correct token with surrounding whitespace. **Intended** (closes S-D17, avoids Vercel raw-env
  lockout), explicitly flagged in handoff §5, pinned by `cron-auth.test.ts:63-74`. Not a defect.
- **L1-b — `createHash().update()` length-dependent timing.** SHA-256 runs more compression blocks
  on longer input. The secret length is **fixed per deployment** (same every request) and per-block
  work is value-independent → no per-request side-channel on the secret's value. Non-exploitable.
- **L1-c — SHA-256 collision bypass.** Requires a preimage against an unknown target digest
  (attacker doesn't know the secret) → 2^256 infeasible. Sound; correctly NOT "upgraded" to HMAC.
- **L3 — `process-payouts` `no_secret` meta is `{}`** (vs peers' `{ msg }`). A **pre-existing**
  divergence preserved verbatim per the §4b mandate. Correct.
- **L5 — `middleware.ts:8-15` hand-rolled `timingSafeEqual` length-leaks the gate cookie.** A
  **separate primitive** (gate password, not CRON_SECRET), **out of scope** per §3/§8, **not a
  regression** from this change. Logged as a candidate future chunk, not a blocker.
- **L5 — comment "handoff §5 LB note"** reference is cosmetic; rationale matches §5. No functional impact.

## 7. Frozen surfaces — re-asserted unchanged (§8)
`getCronSecret()` raw; `env.ts` crypto-free; `middleware.ts`; edge routes (og/opengraph-image); no
new deps / migration / DB / KV; every route's status codes, error codes, body messages, log keys +
fields, and check ordering (rate-limit→auth on the 30 rate-limited routes; `getClientIp`;
github/scan's auth→`isGitHubAppConfigured`→body-parse). All verified untouched.

## 8. ③ POST-SEAL DEEP AUDIT — handoff (high-stakes; runs after operator `/seal-go`)
- **Subject (assert byte-identical at ③ start):** `cron-auth.ts` shasum
  `3e91f144…` — if it differs, the ② seal does not transfer; re-review.
- **Where to concentrate:** the constant-time guarantee end-to-end (no secret-dependent early
  return; the cap-vs-constant, not cap-vs-secret-length); the symmetric-trim broadening as the one
  conscious behavior change; SEAM-6 (re-trace the live `middleware.ts`/`env.ts` import edges, don't
  trust this doc); the LE-09 fail-open class across all 32 `return`s; census completeness (no 33rd
  site added since ②).
- **Frozen / do-not-pull-in:** §7 above. The `middleware.ts` gate-cookie length-leak (L5) is a
  SEPARATE primitive — do NOT fold a fix into this chunk; record it as its own candidate.
- **Ledger ID collision to resolve:** the chunk label "DC-03" (timing side-channel / S-D15) collides
  with the existing `.audit/defect-ledger/DC-03-unauthenticated-forgeable-money-mutation.md` (a
  different class). No new SEAM/LE recurrence this round, so no ledger edit was made — operator to
  confirm the correct ledger ID for the cron-auth defect class before any ledger write.

## 9. Policy / orchestration record
Applied. Env clean (FORK_SUBAGENT / SUBAGENT_MODEL / EFFORT_LEVEL all UNSET — no phase-start trap).
One sanctioned up-front pause taken (orchestration opt-in + core-lens effort): operator chose
**Agent-tool spawns + xhigh core lens** (both the recommended defaults). Path-1 `max` definitions
absent (recorded, not self-authored). Allowlist GREEN (reviewers ran read/git-diff only; gate/repro
integrator-side — caps git/tsc/vitest/lint present). 5-lens fan-out via concurrent Agent-tool spawns
(model `opus`); integrator/seal decision in the main session.

━━ Recommend operator `/seal-go`, then ③ post-seal deep audit. ━━
