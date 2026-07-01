# secrets-config-hardening — ① handoff (build spec) — 2026-06-30

> **Chunk:** `secrets-config-hardening` · **Closes launch-gate blocker:** **G0-2** · **Tier:** **HIGH-STAKES**
> **Queue:** chunk #5 (`docs/tech-debt/launch-gate-queue.md:21`, front-run "do NOW" tier-G0).
> **Base:** local `main` HEAD `ffbfba91` (the ci-test-gate seal, now PUSHED; `web-ci` gate is LIVE on GitHub).
> **This file is the standalone build spec — the build agent reads THIS first, then builds. No build code exists yet.**
> **⚠ PLAN-AUDIT FOLDED (2026-06-30):** the roadmap framed this as a "one-line fix (mirror getApiKeyPepper)." A mechanical trace found that the naive one-line swap is **INSUFFICIENT and would RED the just-shipped `web-ci` gate.** Three load-bearing complications (§5) are folded below. Read §5 before building.

---

## 1. Intent — why this chunk exists

**Goal (one sentence):** make `AP2_SIGNING_SECRET` **fail-CLOSED** so AP2/A2A payment credentials (VDCs — verifiable digital credentials, JWTs) can never be signed/verified with the **public hardcoded `'ap2-dev-secret'`** fallback, which would let anyone forge payment credentials if the env var is unset in prod.

**Why now / who consumes it.** This is **G0-2** — a tier-G0 ("do NOW", launch-independent) blocker. `AP2_SIGNING_SECRET` currently fails OPEN to `'ap2-dev-secret'` at **two sites** (`lib/env.ts:125` getter + `lib/settlement/ap2/credentials.ts:111`, which bypasses the getter with its own inline `?? 'ap2-dev-secret'`). The signing secret keys the HMAC over AP2 VDC JWTs (`signJwt`/`verifyJwt`); a known/public value makes those credentials forgeable. The fix mirrors the established `getApiKeyPepper()` fail-closed pattern (env.ts:42-44).

**It is a launch-gate blocker (G0-2).** Roadmap row (`LAUNCH-GATE-roadmap-2026-06-27.md:49`): *"`AP2_SIGNING_SECRET` fails OPEN to public hardcoded `'ap2-dev-secret'` at TWO sites … AP2/A2A payment credentials forgeable if unset in prod. → Make it fail-CLOSED via `requireEnv` AND redirect `credentials.ts:111` to call that getter."*

---

## 2. Scope confirmation + sizing

- **Source of truth:** `launch-gate-queue.md:21` (chunk #5) + roadmap row **G0-2** (`:49`, box `☐`).
- **Prior chunk cross-check:** ci-test-gate (G4-1) is SEALED + PUSHED; its `--next` named `secrets-config-hardening (G0-2)`. **No sequencing dependency** — independent of the V-N3/MFA + proxy/SSRF tracks (different files). The `web-ci` gate is now LIVE, so this chunk's seal will be the first to run under it: **the vitest gate MUST stay green** (see §5 LBD-2).
- **Sizing decision: KEEP AS PLANNED (G0-2 only) — do NOT merge, but the fix is BIGGER than the roadmap's "one line."** A repo-wide sweep for fail-open secrets (`process.env.X ?? 'literal'`) found **`AP2_SIGNING_SECRET` is the ONLY fail-open *secret*** (a credential whose hardcoded fallback grants a forgeable capability). The other `?? 'literal'` hits are public config (`NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_POSTHOG_HOST`, `ADMIN_EMAIL`) or empty-string fallbacks (`UPSTASH_REDIS_REST_TOKEN ?? ''`, fail-closed-ish). **One candidate sibling — `VISA_API_URL ?? 'https://sandbox.api.visa.com'` (env.ts:147)** — is a DIFFERENT risk class (wrong-endpoint config, not a forgeable secret; Visa TAP is likely dark) → **OUT of this chunk; document as a separate config-correctness follow-up** (keeps the high-stakes chunk focused on the forgeable-signature seam). Do NOT fold unrelated money chunks (#6+) in.

---

## 3. Tier — **HIGH-STAKES**

Triggers (multiple apply): **secret/credential** boundary; **crypto-signing** (HMAC over payment JWTs); **money** (AP2/A2A payment rail); **public/unauth** surface (the `a2a/skills` + `ap2/{verify,settle}` routes); **a live forgeable-credential vulnerability**; **a launch-gate blocker (G0-2)**. The diff is small but it is a **money/crypto correctness boundary** — the high-stakes part is the correctness of the fail-closed semantics, not the line count.

---

## 4. Settled facts (mechanical probes — feed in; do NOT re-derive)

Probes on `main` HEAD `ffbfba91`, this session.

| # | Claim | Result |
|---|-------|--------|
| **F1** | The two fail-open sites | `env.ts:124-126` `getAp2SigningSecret()` = `return process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'` (returns `string`). `credentials.ts:111` = `const secretKey = process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'` then `signJwt(claims, secretKey)` at `:126`. |
| **F2** | The mirror pattern | `getApiKeyPepper()` (env.ts:42-44) = `return requireEnv('API_KEY_PEPPER')`. `requireEnv` (env.ts:3-12) **throws** on missing **OR empty** (`if (!value)`). Type `string`. |
| **F3** | Callers of `getAp2SigningSecret()` | `ap2-proxy.ts:33` (`validateAp2Payment` wrapper) + `ap2-proxy.ts:52` (`validateAp2CredentialString` wrapper) — **both call it EAGERLY as a function argument**, alongside `enabled: isAp2Enabled()`. Both are inside functions (NOT module-top → no import-time throw). No other callers. |
| **F4** | Caller of `provisionCredentials` (site 2) | `a2a/skills/route.ts:75` (the `provision_credentials` skill). The route is **NOT** `isAp2Enabled`-gated before the call → fail-closed makes it 500 (caught → the route's 500 at :109) when the secret is unset. |
| **F5** | The proxy money path | `proxy/[slug]/route.ts:2267` (`handleAp2Proxy`) calls `validateAp2Payment`. Dispatched **only** for AP2 requests: line 506 `if (isAp2Enabled() && isAp2Request(request)) → handleAp2Proxy`; line 392 `switch(verdict.protocol){ case 'ap2': handleAp2Proxy }`. **Non-AP2 (Stripe/x402/MPP) requests route to other handlers → NOT affected.** |
| **F6** | verify/settle facilitator routes | `ap2/verify/route.ts:93` and `ap2/settle/route.ts:90` BOTH early-return `if (!isAp2Enabled())` BEFORE calling `validateAp2CredentialString` (:129 / :122). So when AP2 is **fully** dark (all 3 vars unset → `isAp2Enabled()` false) they return early → no eager getter → no throw. |
| **F7** | `isAp2Enabled()` (env.ts:219) | `return !!process.env.AP2_PROVIDER_KEY \|\| !!process.env.AP2_SIGNING_SECRET \|\| !!process.env.AP2_VERIFICATION_KEY` — **OR over 3 vars.** ⇒ `isAp2Enabled()` true does **NOT** imply `AP2_SIGNING_SECRET` is set (partial-config: e.g. only `AP2_VERIFICATION_KEY` set). **This is a raw presence check — do NOT harden it to `requireEnv`** (it must stay a non-throwing boolean). |
| **F8** | The Core is a frozen package | `ap2-proxy.ts` is a thin app-side re-export of `@settlegrid/mcp` (`packages/mcp/src/adapters/ap2.ts`): `validateAp2PaymentCore`, `validateAp2CredentialStringCore`, `signJwt`/`verifyJwt`, `provisionCredentials` live (or are re-exported) there. **The eager-eval injection is APP-SIDE (`ap2-proxy.ts`) → the fix stays app-side; do NOT edit `@settlegrid/mcp`.** |
| **F9** | vitest env injection | `apps/web/vitest.config.ts:37-43` injects `env: { API_KEY_PEPPER: '…' }` ONLY. **`AP2_SIGNING_SECRET` is NOT injected** → tests run with it UNSET unless they stub it. |
| **F10** | Test reliance on the fallback (the gate-RED risk) | Of 4 AP2-touching test files: `proxy-equivalence.test.ts:262` stubs it (`vi.stubEnv('AP2_SIGNING_SECRET','ap2-test-secret')`). `ap2/__tests__/route.test.ts` **mocks `@/lib/env` wholesale** (`vi.mock('@/lib/env', …)`) → insulated. `smoke.test.ts` doesn't hit the signing path. **`ap2.test.ts` `describe('provisionCredentials')` (lines 225-259) RELIES on the fallback** — `:248` does `verifyJwt(result.vdc, 'ap2-dev-secret')` (signs via the unset→fallback path, verifies against the literal). **BASELINE PROBE: `ap2.test.ts` = 76/76 GREEN with `AP2_SIGNING_SECRET` unset** → confirms it relies on the fallback → a naive fail-closed swap makes `provisionCredentials` THROW → `ap2.test.ts` RED → the `web-ci` gate RED. |
| **F11** | Gate baseline | The full `web-ci` gate is GREEN on `ffbfba91` (node-20 proven, 218f/4992p/61skip/0fail). The fix must keep it green. |

**Defect-class ledger:** the central class is **fail-open default / silent-fallback** (a secret degrading to a public hardcoded value) — the secrets-layer form of the **DC-24 false-green/toothless-control** class the prior chunks recorded. Plus the standing **SEAM** (eager-eval + `isAp2Enabled`≠signing-secret + frozen package) and **LITERAL-EXECUTION** (does `requireEnv` throw where the executor calls it?) classes. (No consolidated ledger file; classes live inline in audit records. ② creates/updates at first bookkeeping.)

---

## 5. The load-bearing decisions most likely to be SILENTLY WRONG (audit concentrates here)

### LBD-1 — the EAGER-EVAL seam: a naive fail-closed getter throws on the AP2 request path even when AP2 is disabled/partial-config
`ap2-proxy.ts:33` + `:52` pass `signingSecret: getAp2SigningSecret()` **eagerly** (evaluated before the Core can short-circuit on `enabled: false`). Today this is harmless (the getter returns `'ap2-dev-secret'`, never throws). **Under a fail-closed getter it THROWS** whenever those wrappers are called and `AP2_SIGNING_SECRET` is unset. Combined with **F7** (`isAp2Enabled()` true ≠ signing-secret set): a **partial config** (e.g. only `AP2_VERIFICATION_KEY` set) passes the `isAp2Enabled()` gates (F5/F6) → reaches the wrapper → **throws** → 500. And the line-392 `verdict.protocol==='ap2'` proxy dispatch may route a dark/partial AP2-shaped request to `handleAp2Proxy` (the build MUST verify whether the verdict classifier can return `'ap2'` when AP2 is disabled — if YES, the eager-throw is REACHABLE on the proxy money path; if NO, it's contained to partial-config).

**RESOLUTION (fold into the plan):** gate the eager getter on enablement in the `ap2-proxy.ts` wrappers — e.g.
```ts
const enabled = isAp2Enabled()
return validateAp2PaymentCore(request, { enabled, toolConfig, signingSecret: enabled ? getAp2SigningSecret() : '', logger: appLogger })
```
so the secret is fetched **only when AP2 is enabled** (dark path → no getter call → no throw). When enabled-but-signing-secret-missing (partial config), `getAp2SigningSecret()` throws — which is the **intended** fail-closed (refuse to sign/verify VDCs without the real secret), NOT a regression. **The build MUST confirm the Core (`@settlegrid/mcp`) checks `enabled` BEFORE using `signingSecret`** (so passing `''` when disabled is never used) — read `packages/mcp/src/adapters/ap2.ts`; do NOT edit it, just verify the ordering. If the Core uses `signingSecret` even when `enabled:false`, escalate (the `''` sentinel choice changes).
**Failure mode if mis-decided:** the naive getter-only fix 500s the AP2 verify/settle/proxy paths on any partial-config (and possibly the dark proxy path), turning a fail-open into a fail-*crash* on a public route.

### LBD-2 — the fix must NOT red the (now-LIVE) `web-ci` vitest gate
Per F9/F10: hardening the getter makes `ap2.test.ts`'s `provisionCredentials` tests throw (they run with `AP2_SIGNING_SECRET` unset and verify against the literal `'ap2-dev-secret'`). **RESOLUTION (fold):**
1. Add `AP2_SIGNING_SECRET: '<test-only value, e.g. ap2_test_signing_secret_not_for_production>'` to `vitest.config.ts` `env` (mirror the `API_KEY_PEPPER` injection at :43) — so the hardened getter doesn't throw across the suite and FUTURE AP2-touching tests don't break.
2. Update `ap2.test.ts:248` `verifyJwt(result.vdc, 'ap2-dev-secret')` → verify against the **injected** value (provisionCredentials now signs with the injected secret, not the literal). **Sweep `ap2.test.ts` (and any other test) for every reliance on the `'ap2-dev-secret'` literal on the provision/getter path** and align it to the injected value. (The direct `signJwt(claims, secret)`/`verifyJwt(jwt, secret)` tests at ~290-315 pass an explicit local `secret` arg — they do NOT hit the getter → leave them.)
3. **Verify global injection is safe:** no test asserts the AP2-*disabled* path via env-unset (the trace found none — `route.test.ts` mocks `isAp2Enabled`; `proxy-equivalence.test.ts` stubs the secret). The build MUST re-run the FULL suite from a clean state and confirm 0 fail (the digest must stay 218f/0fail; skip count unchanged at 61). If any test asserts `isAp2Enabled()===false`-via-unset, switch that test to mock/stub instead of relying on global-unset.
**Failure mode if mis-decided:** the next seal's `web-ci` run is RED (the gate this cadence just shipped), or a test silently passes against the wrong secret.

### SEAM / frozen surfaces (do NOT touch)
- **`isAp2Enabled()` (env.ts:219)** — raw presence check, must stay a non-throwing boolean (F7). Do NOT route it through `requireEnv`.
- **`getAp2VerificationKey()` / `getAp2ProviderKey()` / other optional getters** — return `string | undefined` by design; not in scope.
- **`@settlegrid/mcp` package** (F8) — frozen; the fix is app-side only (`env.ts`, `credentials.ts`, `ap2-proxy.ts`, `vitest.config.ts`, `ap2.test.ts`). Editing the package would also expand the `web-ci` turbo-build surface.
- **`VISA_API_URL ?? sandbox` (env.ts:147)** — out of scope (different risk class); document as a follow-up, do NOT change here.

---

## 5.5 — PLAN-AUDIT FOLDS (3-lens fan-out, 2026-06-30 — these are AUTHORITATIVE; they amend §4/§5/§6)

A 3-lens plan audit (SEAM+LITERAL-EXECUTION · blast-radius+test-completeness · security+money-correctness, all `claude-opus-4-8`, Agent-tool) ran against this handoff. **Verdict: the plan is SOUND and fully closes the forgery hole on BOTH sign + verify sides; no HIGH findings.** Confirmations + corrections the build MUST carry:

**CONFIRMED (no change):** verify uses the SAME hardened getter via the `ap2-proxy.ts` wrappers; the Core (`packages/mcp/src/adapters/ap2.ts`) takes `signingSecret` as a param and reads `process.env` **nowhere** (no residual fail-open verify path); all production throw-sites are the ones in §4 (no module-top/import-time throw); global vitest injection is **safe** (no test asserts the AP2-disabled path via *real* unset env — `route.test.ts` mocks `isAp2Enabled`, `proxy-equivalence` stubs it); the **218-file / 61-skip** invariant is unaffected; `AP2_SIGNING_SECRET` is the **only** fail-open secret (sibling sweep complete); the throw is **pre-charge / pre-ledger** → no money-state corruption; the env-var name does not leak to clients (`internalErrorResponse` is server-side-log only).

**CORRECTION 1 [MED] — `smoke.test.ts:409-412` is a SIXTH edit (F10 was wrong).** `it('getAp2SigningSecret returns fallback in dev')` imports the **real** `@/lib/env` and calls `getAp2SigningSecret()` **directly** (asserts `typeof==='string'` + `length>0`). Under fail-closed it THROWS unless the env is injected. ⇒ (a) **the GLOBAL `vitest.config` injection (edit #4) is MANDATORY — do NOT substitute a per-test `vi.stubEnv` on `ap2.test.ts`, or `smoke.test.ts:411` is left RED**; (b) add `smoke.test.ts` to the edit list + retitle the now-misnamed test (no fallback exists post-fix). The correct LBD-2 sweep criterion is **"any test that calls `getAp2SigningSecret()` or `provisionCredentials` and depends on no-throw"** (not merely "references the `'ap2-dev-secret'` literal").

**CORRECTION 2 [LOW] — LBD-1 step 3 (ap2-proxy eager-eval gating) is DEFENSE-IN-DEPTH, NOT required.** The open question ("can the verdict classifier route a dark request to `handleAp2Proxy`?") is **ANSWERED: NO** — `shouldDispatchUnified` (`_unified-dispatch.ts:129-130`) returns `protocol-disabled` when `isAp2Enabled()` is false (`enabledMap.ap2 = isAp2Enabled`, route.ts:339), and both `handleAp2Proxy` sites (`:392`,`:507`) + verify (`:93`) + settle (`:90`) pre-gate on `isAp2Enabled()`. The Core checks `!enabled` (`ap2.ts:356`) **before** `!signingSecret` (`:377`) before any HMAC → the `''` sentinel is doubly-safe and the `: ''` branch is **dead code** in the current call graph. Step 3 is harmless hygiene — KEEP it, but do **not** believe it makes partial-config safe: partial-config (e.g. only `AP2_VERIFICATION_KEY` set) ⇒ `isAp2Enabled()` true ⇒ getter still throws, which **IS** the intended fail-closed (a strict improvement over today's forgeable-accept). The only genuinely reachable behavior change is the **partial-config / a2a-skills 500**, covered by the §P cue.

**CORRECTION 3 [LOW] — F8 hedge wrong:** `provisionCredentials` is **exclusively app-side** (`credentials.ts`), NOT in `@settlegrid/mcp` (grep of the package for `provisionCredentials`/`AP2_SIGNING_SECRET`/`ap2-dev-secret` is empty). Single fix site `credentials.ts:111` is correct; **no package edit** is forced (the Core only receives `signingSecret` via options).

**§P CUE ENRICHMENT [LOW]:** the §9 §P operator item must ALSO state: (1) **entropy** — use a high-entropy value (≥32 bytes), mirroring `getApiKeyPepper`'s comment; (2) **`AP2_SIGNING_SECRET` is the ONLY AP2 secret the code reads today** — `AP2_VERIFICATION_KEY`/`AP2_PROVIDER_KEY` are UNREAD on the live path (the VDC HMAC is symmetric → verify uses the *signing* secret), so an operator who "enables" AP2 by setting only the verification/provider key gets `isAp2Enabled()` true yet every AP2 request 500s (latent operability trap — document, do not block); (3) **rotation** — VDCs are short-lived (`exp = iat + 3600`), so rotating the symmetric secret only invalidates ≤1h of outstanding credentials.

**OUT-OF-SCOPE NOTES (do NOT fold; future hygiene follow-ups):** the app-side `verifyJwt` (`credentials.ts:37`) uses a non-timing-safe `!==` compare vs the Core's `timingSafeEqual` — but it is NOT on any live verify path (live verify = the Core's `verifyVdcJwt`), so it's not a forgery vector; `ADMIN_EMAIL ?? 'lexwhiting…@gmail.com'` is a hardcoded-personal-email default across 6 cron routes (wrong-recipient/PII smell, not a forgeable secret — correctly OUT); `VISA_API_URL ?? sandbox` (config, deferred). File one-line follow-ups; none belong in this chunk.

---

## 6. Build plan (the builder executes; owns minor choices)
> **READ §5.5 (PLAN-AUDIT FOLDS) FIRST — it amends this list: step 3 is defense-in-depth (not required), edit #4's GLOBAL injection is mandatory, and there is a SIXTH edit (`smoke.test.ts`).**

1. **`env.ts:124-126`** — `getAp2SigningSecret()`: replace the body with `return requireEnv('AP2_SIGNING_SECRET')` (mirror `getApiKeyPepper`). Keep return type `string`. Add a fail-closed comment mirroring `getApiKeyPepper`'s.
2. **`credentials.ts:111`** — replace `const secretKey = process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'` with `const secretKey = getAp2SigningSecret()` (add `import { getAp2SigningSecret } from '@/lib/env'`). Deletes the inline fallback; routes through the single hardened getter.
3. **`ap2-proxy.ts:33` + `:52`** — gate the eager getter on `enabled` (LBD-1): compute `const enabled = isAp2Enabled()` once, pass `signingSecret: enabled ? getAp2SigningSecret() : ''`. FIRST verify (read-only) the Core checks `enabled` before using `signingSecret` (`packages/mcp/src/adapters/ap2.ts`). If the verdict classifier can route a dark/partial request to `handleAp2Proxy`, this step is REQUIRED (not just defense-in-depth) — confirm and state which.
4. **`vitest.config.ts`** — add `AP2_SIGNING_SECRET` to the injected `env` block (LBD-2).
5. **`ap2.test.ts`** — align `:248` to the injected secret; **recommend `verifyJwt(result.vdc, process.env.AP2_SIGNING_SECRET!)`** to avoid literal-drift coupling with vitest.config (LBD-2). Leave the `signJwt`/`verifyJwt` tests at ~289-315 (explicit local `secret` arg — they don't hit the getter).
6. **`smoke.test.ts:409-412`** (per §5.5 CORRECTION 1) — `it('getAp2SigningSecret returns fallback in dev')` calls the getter directly; retitle it (no fallback exists post-fix) and keep its assertions green via edit #4's GLOBAL injection (or assert against `process.env.AP2_SIGNING_SECRET`). Required so the file stops asserting a removed semantic.

**Verification the build MUST do (the heart of the chunk):**
- Run the FULL `apps/web` gate sequence from the dev tree (tsc + lint + vitest) and confirm **0 fail**, **skip count still 61**, file count 218 (the `web-ci` digest invariant). Pin a regression test if cheap (e.g. a unit test asserting `getAp2SigningSecret()` throws when the var is unset — using `vi.stubEnv('AP2_SIGNING_SECRET','')` + `expect(() => …).toThrow()`), so the fail-closed behavior is itself gated. (This is the "pin a regression test" the `web-ci` gate exists to keep green.)
- Behaviorally confirm the fail-closed: with the secret stubbed-empty, `getAp2SigningSecret()` throws; with it set, signing/verifying round-trips. Confirm the dark path (`isAp2Enabled()` false) does NOT throw (LBD-1).
- `git`, `npx tsc`, `npx vitest`, `npm run lint` are session-allowlisted; `npx next typegen`/`npx turbo run build` PROMPT (run in foreground if a full clean-clone gate is wanted — but the dev-tree gate run suffices for the build's self-verification; ② re-runs from clean).

---

## 7. Scope boundaries (reject creep)
- **IN:** the 5 edits above (env getter fail-closed, credentials.ts via getter, ap2-proxy eager-eval gating, vitest.config injection, ap2.test alignment) + an optional fail-closed regression test + the §P prod-env confirmation cue.
- **OUT:** editing `@settlegrid/mcp`; hardening `isAp2Enabled` or the optional getters; the `VISA_API_URL` fallback (separate follow-up); adding clean `isAp2Enabled` gating to the `a2a/skills` provision route (a 500-on-unset there is acceptable fail-closed — note it, optionally fold a one-line gate ONLY if trivial, else defer); any other secret/config beyond AP2_SIGNING_SECRET; the money chunks #6+.
- **Do NOT** commit any secret value; **do NOT** push (separate `/push-go`); the prod-env-set confirmation is an OPERATOR/§P action.

## 8. Commit hygiene (explicit pathspec — never `git add -A`)
**INCLUDE:** `apps/web/src/lib/env.ts`, `apps/web/src/lib/settlement/ap2/credentials.ts`, `apps/web/src/lib/ap2-proxy.ts`, `apps/web/vitest.config.ts`, `apps/web/src/lib/__tests__/ap2.test.ts`, `apps/web/src/__tests__/smoke.test.ts` (§5.5 edit #6), (+ any new regression test file), this handoff + the ②/③ records.
**EXCLUDE (pre-existing uncommitted — leave untouched):** `apps/web/src/app/(dashboard)/dashboard/tools/page.tsx`, `docs/SECURITY-INCIDENT-2026-06-15-exposed-pg-credential.md`, `.claude/`, `docs/tech-debt/launch-gate-queue.md`, `docs/tech-debt/v-n3-mfa-unenroll-hardening-handoff-2026-06-27.md`, `scripts/mfa-delete-smoke.sh`, `docs/tech-debt/ci-test-gate-postseal-deepaudit-2026-06-30.md`.

## 9. Seal bookkeeping (at ② seal, not during build)
Tick **G0-2** `☐→☑` in `LAUNCH-GATE-roadmap-2026-06-27.md:49` (roadmap is gitignored → local-only); the PostToolUse hook recounts (16→15, still RED). Add a **§P operator cue**: confirm `AP2_SIGNING_SECRET` is set in prod IF AP2 is meant to be LIVE; if AP2 is intentionally DARK (secret unset), document that fail-closed means AP2 requests 500 (acceptable — the path is disabled). The `web-ci` gate must be GREEN on the seal commit (first chunk sealed under the live gate).

## 10. Chunk lifecycle
scope-confirm ✓ → draft plan ✓ → **pre-build plan audit (this session — runs before any build code)** → build → executable gate (full suite, 0 fail, 61 skip) → ② seal-gating review → seal + bookkeeping (§9) → ③ post-seal deep audit (if high-stakes-warranted).

## 11. Build directives (carry verbatim into the build)
(a) **Self-verify at intervals with fresh-context subagents** (not self-critique). The verifier returns positive EVIDENCE: exact gate command(s), exit code(s), and a NORMALIZED digest (exit + canonical pass/skip/fail counts + the skipped-id set; strip timestamps/durations/paths). Evidence-free "green" = RED. `git`/`npx tsc`/`npx vitest`/`npm run lint` are allowlisted (a fresh subagent can run them); `npx next typegen`/`npx turbo run build` PROMPT (run in foreground; have the subagent AUDIT the evidence — gate-runner ≠ verifier). Confirm `CLAUDE_CODE_FORK_SUBAGENT` unset at the start of each verification pass.
(b) **Ground every claim in a tool result from this session** — run the real command; never "looks done."
(c) **Act once you have enough to act** — no re-deriving §4 facts, no surveying options you won't take.
(d) **Calibrate autonomy:** own minor choices (the test-secret literal value, comment wording, whether to pin the regression test, the `''`-vs-sentinel for the disabled path) and note them; for scope changes or irreversible/outward actions (editing `@settlegrid/mcp`, committing a secret, pushing, touching `vercel.json`) ask first.
(e) **Delegate + search explicitly:** fan out to fresh-context subagents for independent checks (the Core-ordering read vs the full-suite gate run are independent); search the repo when a convention isn't known (sweep ALL `'ap2-dev-secret'` literals + all `getAp2SigningSecret`/`provisionCredentials` callers).
(f) **Don't over-narrate** — silence between routine tool calls; lead the final summary with the outcome.
(g) **Don't stop the WORK on account of context** (the harness manages it) — but honor the standing context-degradation alert if it triggers.
(h) **End with a cadence-status report when the gate is green** — attach the self-verification EVIDENCE (gate command + exit code + normalized digest incl. skip set) + a short diff/build manifest (incl. the literal `git add` pathspec line) so ② can confirm the gate ACTUALLY RAN. Evidence-free green = RED.
(i) **Escalate effort only for a genuinely hard sub-problem** (none expected — this is a bounded secrets-config fix). Build runs at the session's pinned `xhigh`. If a real snag appears (e.g. the Core uses the secret when disabled, forcing a redesign), queue an operator `/effort max` for that stretch then revert; don't stall — note it, proceed at `xhigh`, flag for ②.
