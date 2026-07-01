# secrets-config-hardening — ② seal-gating review (SEAL RECORD) — 2026-06-30

> **Chunk:** `secrets-config-hardening` · **Closes launch-gate blocker:** **G0-2** · **Tier:** **HIGH-STAKES** (not escalated)
> **Verdict:** **② ✅ SEAL CLEAN** — gate GREEN on sealed bytes, **zero HIGH / zero MED** open across 5 lenses, **1 LOW folded** (comment accuracy) + re-verified green.
> **Status:** certified clean, **pending operator `/seal-go` + explicit-pathspec commit** (Claude cannot self-seal).
> **Base:** local `main` HEAD `ffbfba91` (ci-test-gate seal; `web-ci` gate LIVE). **This is the first chunk sealed under the live `web-ci` gate.**
> **Handoff (spec):** `docs/tech-debt/secrets-config-hardening-handoff-2026-06-30.md`

---

## 1. What was built (realized diff — 6 files, matches handoff §6 as amended by §5.5)

| # | File | Change |
|---|------|--------|
| 1 | `apps/web/src/lib/env.ts` | `getAp2SigningSecret()` body `?? 'ap2-dev-secret'` → `return requireEnv('AP2_SIGNING_SECRET')` (mirrors `getApiKeyPepper`; return type `string`). Fail-closed design comment added. **(② folded: comment accuracy corrected — see §4.)** |
| 2 | `apps/web/src/lib/settlement/ap2/credentials.ts:114` | inline `process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'` → `getAp2SigningSecret()` (new `import { getAp2SigningSecret } from '@/lib/env'`). |
| 3 | `apps/web/src/lib/ap2-proxy.ts` (both wrappers) | hoist `const enabled = isAp2Enabled()`; pass `signingSecret: enabled ? getAp2SigningSecret() : ''` (LBD-1 enablement-gated eager eval). |
| 4 | `apps/web/vitest.config.ts` | inject `AP2_SIGNING_SECRET: 'ap2_test_signing_secret_not_for_production_use_only'` into `test.env` (LBD-2; non-prod placeholder). |
| 5 | `apps/web/src/lib/__tests__/ap2.test.ts` | provision verify test → `verifyJwt(result.vdc, process.env.AP2_SIGNING_SECRET!)`; **new** `describe('getAp2SigningSecret fail-closed')` (2 tests: throws-on-empty regression + returns-configured). |
| 6 | `apps/web/src/__tests__/smoke.test.ts` | retitled the now-misnamed `'returns fallback in dev'` getter test + explanatory comment. |

Working tree = exactly these 6 (modified) + the documented pre-existing EXCLUDE set (`dashboard/tools/page.tsx`, `SECURITY-INCIDENT-2026-06-15…`, `.claude/`, `launch-gate-queue.md`, `v-n3-mfa-unenroll-hardening-handoff…`, `scripts/mfa-delete-smoke.sh`, `ci-test-gate-postseal-deepaudit…`) + the untracked handoff (to add at commit per §8). **No stray file. No frozen surface perturbed** (`isAp2Enabled`, `@settlegrid/mcp`, `VISA_API_URL`, optional getters all untouched).

## 2. Gate evidence (② clean, isolated re-run — post-fold, on sealed bytes)

- **Command / cwd:** `npx tsc -p apps/web/tsconfig.json --noEmit`; `npm run lint --workspace=@settlegrid/web`; `npx vitest run` with **cwd=`apps/web`** (matching `.github/workflows/web-ci.yml` `working-directory: apps/web`).
- **Exit codes:** `tsc=0`, `lint=0` (warnings-only), `vitest=0`. `CLAUDE_CODE_FORK_SUBAGENT` unset at gate time.
- **Normalized digest (dev-box, gitignored docs PRESENT → 0 skip):** **218 files passed / 5055 tests passed / 0 skip / 0 fail.**
- **Reconciliation:** ci-test-gate CI baseline = 4992 pass + **61 skip** (docs absent). Dev-box docs-present = 4992+61 = 5053, **+2** new fail-closed regression tests = **5055 / 0 skip**. The real `web-ci` run in CI (docs absent) = **4994 pass / 61 skip / 0 fail** — both 0-fail.
- **RED-herring resolved:** a first ② run used `vitest --root apps/web` from repo root, which set vitest's root but left `process.cwd()` at the repo root → 4 `process.cwd()`-relative **source-census** tests (`settled-value`, `credit-writer-census`, `verifier-exactamount-census`, `billing-credits`) hit `ENOENT` on `/Users/lex/settlegrid/src/...`. That was a **false RED from the invocation**, not the diff (none of the 4 touch AP2). Re-run with `working-directory: apps/web` (the CI form) → GREEN. **Gate-fragility note (pre-existing, not this chunk):** those census tests only pass when vitest runs with cwd=`apps/web`.

## 3. Review — 5 lens-distinct fresh-context reviewers (Agent-tool, model `claude-opus-4-8[1m]`)

Orchestration: **Agent-tool spawns** (operator-selected; Path-1 named subagents absent → ad-hoc spawns inheriting session effort). Effort self-reported **high** by all 5 (model-unreliable; the operator's chosen xhigh target not independently confirmable — recorded as a Policy caveat; the phase's `max` core-invariant depth is deferred to ③, which follows for high-stakes). Allowlist GREEN (reviewers Read-only; the gate + Docker-free repro ran foreground in the main session). Env traps unset.

| Lens | Verdict |
|------|---------|
| **Core-invariant crypto/money (forgeability)** | **CLEAN — no HIGH/MED.** `''` sentinel can never key an HMAC (only passed when `enabled=false`; Core returns at `!enabled` (ap2.ts:356) before any secret use; `!''` truthy → `AP2_NOT_CONFIGURED` even if reached). Only one prod sign path (`provisionCredentials`→`signJwt`), now fail-closed; no other fallback sign path. Verify keyed by the SAME hardened secret (`AP2_VERIFICATION_KEY` has zero prod consumers; symmetric HMAC). All partial-config throws are **pre-charge/pre-ledger** on all 4 public routes (proxy 500 before `forwardAndBill`; verify/settle 500 before ledger write; a2a/skills 500, no VDC). App-side non-timing-safe `verifyJwt` is dead on live paths (tests only). |
| **Spec-conformance** | **CONFORMANT.** All 6 edits present/correct; frozen surfaces intact; no scope creep; EXCLUDE set unperturbed; test secret is a non-prod placeholder. |
| **Test correctness / hermeticity** | **PASS — gate green for the right reason.** Fail-closed test (a) has **revert-resistant teeth** (fails under all three plausible regressions: `?? 'ap2-dev-secret'`, `|| 'ap2-dev-secret'`, `requireEnv` loosened to `=== undefined`). `vi.stubEnv(name,'')` → real `''` (verified vs vitest source) → throws. `finally { vi.unstubAllEnvs() }` restores to the injected value (snapshot captured post-`test.env`); no cross-test leak; no global `unstubEnvs`/setupFiles. Injection masks **no existing** disabled-path assertion (route.test.ts mocks `isAp2Enabled`; proxy-equivalence stubs it) → LBD-2 holds. |
| **SEAM** | No funds-safety/security seam. All load-bearing claims validated (requireEnv throws; no import-time throw; Core ordering both functions; vitest env reaches process.env; literal fully eliminated; dispatcher pre-gates AP2). Two LOW behavior/comment seams (see §4). |
| **LITERAL-EXECUTION** | All 8 checks confirmed (ternary short-circuits; ap2.ts:356/377 guards exact; throw string contains `AP2_SIGNING_SECRET`; `stubEnv('','')`→falsy; sign-secret==verify-secret; retitled smoke test passes). One LOW comment-accuracy (see §4). |

## 4. Findings ledger (all LOW/INFO — none blocked the seal)

**FOLDED (1):**
- **[LOW · SEAM + LITERAL-EXECUTION convergence] `env.ts:128-129` comment overstated the dark-path safety model** — "when fully dark this getter is never called … a dark deploy does NOT throw" is false: `provisionCredentials` (credentials.ts:114) calls the getter **unconditionally** and its caller `a2a/skills` (`route.ts:66-83`, `provision_credentials`) is **not** `isAp2Enabled`-gated, so a dark-deploy provision request reaches the getter → `requireEnv` throws → caught → **500** (fail-closed, but the getter *is* called). **Fix (pure comment, zero behavior/test change):** the comment now states the ap2-proxy verify/settle/proxy wrappers gate the call on enablement (those paths don't throw dark), while `provisionCredentials` (a2a/skills) calls it unconditionally → a dark/partial provision request fail-closes with a 500. **Re-review calibration:** comment-only ⇒ no fresh-context re-spawn; full gate re-run GREEN on the folded bytes (§2).

**DOCUMENTED — not folded (rationale each):**
- **[LOW · SEAM] Partial-config yields 500, not the Core's graceful 402 `AP2_NOT_CONFIGURED`.** When `isAp2Enabled()` is true via `AP2_PROVIDER_KEY`/`AP2_VERIFICATION_KEY` but `AP2_SIGNING_SECRET` is unset, the wrapper's eager `getAp2SigningSecret()` throws → 500, bypassing the Core's designed 402 branch (ap2.ts:377). **This is the *intended* fail-closed** per handoff §5.5 CORRECTION 2 and the env.ts comment. Not folded: a clean-402 path would require touching the a2a/skills gate / wrappers beyond handoff scope (§7 OUT). → **§P operability cue.**
- **[INFO · out-of-scope, pre-existing] `a2a/skills` `provision_credentials` is unauthenticated (rate-limited only)** and mints a validly-signed VDC for arbitrary `amountCents`/`consumerId` — forgeability-equivalent in effect. **Not touched by this diff**; the diff strictly *improves* it (fail-closed 500 vs public-secret mint). Handoff §7 already deferred a2a/skills gating. → **separate follow-up chunk** (auth/enablement gate on the provision skill).
- **[INFO] `requireEnv` accepts a whitespace-only value** (`' '` truthy) → weak HMAC key; identical semantics to `getApiKeyPepper`; operator residual, not introduced here. The `≥32-byte` entropy guidance is advisory (not enforced). → **§P cue.**
- **[LOW] Test-quality nits (no false-green):** `smoke.test.ts:409` title claims "fail-closed, no fallback" but only asserts `typeof`+`length>0` (real teeth live in ap2.test.ts (a); fails loudly if injection absent, so not vacuous); ap2.test.ts (b) is near-tautological; the `.toThrow(/AP2_SIGNING_SECRET/)` regex could tighten to `/Missing required environment variable: AP2_SIGNING_SECRET/`. Adequate as-is; tightening deferred to avoid gold-plating a passing suite.
- **[LOW] Forward test hazard:** the global `AP2_SIGNING_SECRET` injection flips `isAp2Enabled()`'s default to true, so a FUTURE dark-by-default test must explicitly stub-empty/mock. No current test masked (LBD-2 confirmed). → handoff note.

## 5. Defect-class ledger

- **Primary class CLOSED:** fail-open-default / silent-fallback secret (a credential degrading to a public hardcoded value) — the **secrets-layer form of DC-24 (false-green / toothless-control)**. `AP2_SIGNING_SECRET` was the ONLY fail-open *secret* in the repo (sibling sweep complete); now fail-closed via `requireEnv`, gated by a **revert-resistant** regression test.
- **SEAM / LITERAL-EXECUTION recurrence (folded):** a **load-bearing security-design comment** that overstated the runtime safety model (dark-path "never throws"). Recurrence sub-class of the standing SEAM/LITERAL-EXECUTION classes: *code correct, its own explanatory comment inaccurate about a reachable path.* Caught by two independent lenses converging; folded as a pure-comment correction. (Noted in `.audit/defect-ledger/DC-24-*`.)

## 6. Seal bookkeeping — what the operator's `/seal-go` finalizes

1. **Explicit-pathspec commit (never `git add -A`)** — INCLUDE exactly:
   `apps/web/src/lib/env.ts` · `apps/web/src/lib/settlement/ap2/credentials.ts` · `apps/web/src/lib/ap2-proxy.ts` · `apps/web/vitest.config.ts` · `apps/web/src/lib/__tests__/ap2.test.ts` · `apps/web/src/__tests__/smoke.test.ts` · `docs/tech-debt/secrets-config-hardening-handoff-2026-06-30.md` · `docs/tech-debt/secrets-config-hardening-seal-record-2026-06-30.md`
   EXCLUDE (leave uncommitted): `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-2026-06-15…`, `.claude/`, `launch-gate-queue.md`, `v-n3-mfa-unenroll-hardening-handoff…`, `scripts/mfa-delete-smoke.sh`, `ci-test-gate-postseal-deepaudit…`.
2. **Tick G0-2 `☐→☑`** in `LAUNCH-GATE-roadmap-2026-06-27.md:49` (gitignored → local-only); PostToolUse recounts **16→15**, gate stays **RED**.
3. **Do NOT push** (`/push-go` is separate) and **do NOT commit any secret value**.

## 7. §P operator cue (confirm before/at prod promotion; carries handoff §5.5 §P enrichment)

- **Set `AP2_SIGNING_SECRET` in prod IF AP2 is meant to be LIVE.** Use a **high-entropy value (≥32 bytes)** (advisory; not enforced by `requireEnv`, which rejects only empty — a whitespace value would be a weak key).
- **`AP2_SIGNING_SECRET` is the ONLY AP2 secret read on the live path.** `AP2_VERIFICATION_KEY` / `AP2_PROVIDER_KEY` are UNREAD (the VDC HMAC is symmetric → verify uses the *signing* secret). **Operability trap:** "enabling" AP2 by setting only the verification/provider key makes `isAp2Enabled()` true yet **every AP2 request 500s** (fail-closed refusal). Set the signing secret, or leave AP2 fully dark.
- **If AP2 is intentionally DARK** (secret unset): fail-closed means AP2 verify/settle/proxy paths are disabled-gated (no throw), and a `provision_credentials` request 500s — acceptable (the path is off).
- **Rotation:** VDCs are short-lived (`exp = iat + 3600`), so rotating the symmetric secret invalidates ≤1h of outstanding credentials.

## 8. Follow-ups filed (out of this chunk)
- **[MED-ish, security]** Gate/authenticate the `a2a/skills` `provision_credentials` skill (unauthenticated signed-VDC mint; pre-existing). Consider `isAp2Enabled()` gate + auth.
- **[LOW, config-correctness]** `VISA_API_URL ?? 'https://sandbox.api.visa.com'` wrong-endpoint fallback (handoff §5.5 deferred).
- **[LOW, hygiene]** app-side non-timing-safe `verifyJwt` (credentials.ts:37) — dead on live paths today; make timing-safe or delete before any route imports it.
- **[LOW, test]** tighten the fail-closed regex + a2a dark-by-default test guard when next touching AP2 tests.

---

**Policy:** applied. Tier HIGH-STAKES, not escalated (additive, money/crypto correctness boundary; no frozen surface touched). Env traps unset. Allowlist GREEN. Orchestration = Agent-tool spawns (operator-selected). ⚠ Effort caveat: reviewers self-reported `high` (model-unreliable; xhigh not independently confirmable); the `max` core-invariant depth is deferred to ③ (warranted for high-stakes). Model: all reviewers `claude-opus-4-8[1m]`.
