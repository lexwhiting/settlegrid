# proxy-idempotency-keys — ③ POST-SEAL DEEP AUDIT — 2026-07-01

> **Chunk:** `proxy-idempotency-keys` · **Closes launch-gate blocker:** **G3-3** (idempotency-key gap on the live metered billing rail) · **Tier:** **HIGH-STAKES** (confirmed, not escalated)
> **Base:** ② seal commit `bab0e3ec` (local `main` HEAD, UNPUSHED). Predecessor: `f77eb2c8` (consumer-abuse-hardening ③, PUSHED).
> **Scope:** the INTEGRATED WHOLE on the committed tree — distinct from the ②-seal diff scope.
> **Verdict:** **RE-CERTIFIED (hardened)** — one confirmed latent double-charge (③ F2) closed fix-first; seal otherwise stands.

---

## 0. High-stakes confirmation
Confirmed HIGH-STAKES: real spendable `globalBalanceCents`/`consumerToolBalances` debit; a new exactly-once correctness invariant; edits to the frozen core proxy billing rail (`route.ts`); a new untrusted-input boundary (client `Idempotency-Key` header); launch-gate blocker G3-3. ③ warranted.

## 1. Method
- **Policy:** Model = `claude-opus-4-8` (every reasoning role). Effort = session **xhigh** (operator-confirmed); reviewers self-reported "high" (model-unreliable per policy — not credited as an independent xhigh confirmation; the collective-miss **max** bump was NOT taken, operator-selected, noted). Env traps unset (`FORK_SUBAGENT`/`SUBAGENT_MODEL`/`EFFORT_LEVEL`). Allowlist GREEN (git/tsc/vitest/lint; the gate ran foreground in the main session; reviewers Read/Grep + optional isolated-worktree probes).
- **Orchestration:** Agent-tool spawns (operator-selected). 4 lens-distinct fresh-context reviewers batched concurrently → a collective-miss critic seeded with all four → integrator fix-fold + verdict in the main session.
- **Mechanical pre-flight (fed to reviewers; not re-derived by them):** full gate from clean, cwd `apps/web` (matches `web-ci`): `tsc` exit 0 · `lint` exit 0 · `vitest` **222 files / 5101 passed / 0 skip / 0 fail** (the sealed digest). Plus an integrator invariant re-derivation (tri-state soundness; failover post-billing throw surface; release/claim placement; DC-01 not-widened; crypto-rail separation).

## 2. Lenses & coverage
1. **Money / idempotency core-invariant** (the deferred max-depth lens, run at xhigh): exactly-once across all money-writers; the failover null-after-billing sharp edge; `chargeGated` vs the actual charge; phantom-claim-on-exception.
2. **SEAM:** each shipped procedure vs the codebase's stated contract on the same primitive (upstash `SET NX`, `tryRedis`, `hashBody`, release-awaited, `MONEY_LOSS_KEYS`, crypto-rail dedup separation).
3. **Literal-execution / hostile-input / test-teeth:** the client-header battery; the GET/empty-body blast radius; DC-24 teeth (empirically, in an isolated worktree).
4. **Concurrency / atomicity + cross-chunk integration seams:** concurrent claim/charge/release interleavings; SSRF/rate-limit/402 ordering; cache-TTL vs claim-TTL; DC-01 #1/#6 not-widened.
5. **Collective-miss critic** (xhigh): what all four missed + an adversarial refutation attempt on the one finding about to be folded.

## 3. What the seal got RIGHT (independently re-confirmed at integrated scope)
- **Failover null-after-billing is EMPTY / money-safe** (money-core + critic, agreeing with the integrator's read). `injectAttributionAndReturn` is `async`, so *invoking* it cannot throw synchronously; any internal throw becomes a rejected promise that is NOT awaited in `attemptFailover`'s `try` → it rejects the function → the caller's `await` rejects → the outer catch (route.ts:1222) handles it **without** releasing → money-safe. The only synchronous surface (2846–2899: `db.insert().values()` builder, `logFailoverEvent`=logger.info, the `Headers` copy, `addFailoverHeaders`) is provably non-throwing for runtime-validated fetch headers. The ② defense-in-depth fast-follow (make `attemptFailover` never-return-null-after-billing) remains a valid **theoretical** hardening but is **NOT a live bug** — non-reproducible, so not folded (a fix cannot be reproduced fail-then-pass).
- **All six SEAMs sound:** `SET NX`→`'OK'`/`null` (matches `@upstash/redis@1.37.0` type + the circle-nano/x402 precedents; `ex` in seconds); `tryRedis` tri-state (null only on a thrown/rejected op → a non-`'OK'` value classifies as duplicate = fail-CLOSED = money-safe); `hashBody` identity (idem key == cache key input; the duplicate-response reads the key the writer wrote); release-awaited (required per the documented Vercel-freeze constraint); `MONEY_LOSS_KEYS` **code-side complete** (`money_loss:'true'` Sentry tag stamped — paging is an external alert-rule = §S/§P); crypto-rail (mpp/circle-nano/x402) early-returns **before** the api-key gate → no double-cover, no gap.
- **Client-header boundary hardened:** cross-format collision impossible (`hdr:` sentinel vs `GET:`/`POST:` prefixes are disjoint, and only GET/POST reach the handler so `method` can never be `"hdr"`); cross-consumer/cross-tool impossible (trusted fixed-position prefixes, untrusted key last, sha256); Redis key always fixed 76 chars; multi-valued/unicode/control/whitespace all safe; header can only make dedup *more* aggressive = safe money direction; pre-claiming is self-harm only.
- **DC-24 teeth are REAL** (empirically: neutering the duplicate-skip flips exactly the 3 behavioral tests RED; 13 unit tests green).
- **DC-01 #1/#6 credit-without-collect NOT-WIDENED:** git-blame confirms the cache-hit (797) and failover (2812) debit blocks were last touched by `25fd6f6d` (V-N3), not the gate commit; the gate can only *reduce* requests reaching those sites.
- **HEAD path CLEAN; `costCents` stable across pre-check/claim/debit; fraud is log-only; requestId no collision.**

## 4. FOLD — ③ F2 (confirmed latent double-charge) — CLOSED fix-first
**Finding (concurrency lens; critic CONFIRMED after four failed refutations).** `releaseCharge` is an unconditional, ownerless `del(key)`, and the two release sites fired on `if (idemKey)` — including the **fail-open path**. A request whose claim returned `'unavailable'` (Redis down at claim time) proceeds fail-open and **never SET a key**, yet still reached a release at its no-charge exits. Exploit interleaving (all byte-identical → identical key K):
1. (t0) Redis down → A claims → `'unavailable'`, proceeds without setting K.
2. (t1) Redis recovers.
3. (t2) B (retry) claims K → `'won'`, charges.
4. (t3) A's upstream errors → A `releaseCharge` → `del(K)` **deletes B's live claim A never owned**.
5. (t4) C (retry) claims K → `'won'` → charges again.
→ B and C both debit one logical request, **both under healthy Redis** — *outside* the accepted "outage ∩ retry, single-alert-covers-it" envelope (and A's `idempotency_gate_unavailable` alert points at a charge that never happened, so the real double-charge sits un-flagged). Confidence HIGH · Severity MED (catastrophic direction, narrow timing).

**Fix (minimal, in the authorized gate surface):** hoist `let claimOwned = false`; set it `true` only on `claim === 'won'`; gate BOTH releases on `claimOwned` (route.ts:965, 1021). Rationale: the only requests that both hold a key and can reach a release are winners (`'duplicate'` returns early; `'unavailable'` set no key). A fail-open request now holds no key and never deletes one.

**Sufficiency invariant (recorded as load-bearing):** the boolean fix is sufficient because a winner always releases before its own claim can expire and be re-won — i.e. `CHARGE_IDEM_TTL_SECONDS (120) > route maxDuration (90)`. A comment at the TTL definition (`proxy-idempotency.ts`) now pins this coupling and points to the fencing-token upgrade (`releaseCharge` compare-and-del on a stored requestId) as the invariant-independent alternative if the TTL is ever lowered. Fencing token deferred (chunk minimality mandate; the sibling TTL-expiry race is unreachable under 120 > 90).

**Live reproduction (fail-then-pass):**
- RED against shipped bytes: new test *"a fail-open (Redis-down-at-claim) request never DELETEs the shared key (③ F2)"* — `expect(delSpy).not.toHaveBeenCalled()` failed (delSpy called once = the wrongful `del`).
- GREEN after the fix. The FOLD-1 source-scan was updated to pin the guarded form and assert the ungated `if (idemKey) await releaseCharge(idemKey)` is GONE (so reverting the fix flips it RED too).
- Test-hygiene fix: `beforeEach` now `mockReset()`s the select queue — a pre-existing latent leak (a deduped 2nd request consumes fewer SELECTs than primed, leaving a leftover row) that the new tests exposed.

## 5. Also folded — ③ C1 (behavioral teeth for the new public boundary)
The client `Idempotency-Key` wiring (`readIdempotencyKeyHeader` → `chargeIdemKey.clientKey`, incl. the ② FOLD-A per-tool scoping) had **no behavioral test** — deleting the wiring left the suite green. Added *"an explicit Idempotency-Key dedups a VARIED-body retry end-to-end (③ C1 / FOLD A)"*. **Teeth verified live:** neutralizing the header wiring (`clientKey: null`) flips it RED (`X-SettleGrid-Duplicate` null instead of `'true'`), restored → GREEN.

## 6. Documented residuals (NOT folded — money-safe, pre-existing, or operational)
1. **Optimistic 2xx duplicate before the winner settles** (concurrency F1 / critic M4) — a concurrent in-flight loser gets a `200 {duplicate:true}` before the winner's outcome is known; if the winner then fails+releases, the loser was told success for a request never served. **Money-safe** (never charges). Inherent to FOLD 7's deliberate 2xx choice; the real fix (wait-for-winner / stored-response replay) is the explicitly out-of-scope "full framework." Severity MED (availability/correctness).
2. **Redis LRU/maxmemory eviction of a live claim → un-alerted re-charge** (critic M3) — distinct from cache-TTL>claim-TTL; if the money-rail Redis evicts a still-valid claim under memory pressure while healthy, a retry re-charges with **no** `idempotency_gate_unavailable` alert. **§P/§S operational invariant: confirm the Upstash/Redis `maxmemory-policy` is `noeviction`** (or that claim keys are exempt). Not code-closeable. Severity LOW-MED (config-gated).
3. **Poll-collapse has a developer-revenue magnitude for cacheable tools** (critic M5, sharpening FOLD 4a) — pre-gate a cacheable/GET tool polled with identical body was charged per poll; post-gate it is charged once per 120s window (→ dev revenue under-collection; GET amplified since empty body ⇒ one key per consumer+tool regardless of query, which is never forwarded). **Money direction safe** (under-collection). **Founder/product sign-off item:** re-confirm the poll-collapse is acceptable at this revenue magnitude for high-frequency-identical-poll cacheable tools (opt-out = a varying `Idempotency-Key`). This is the ③ re-confirmation of the #5 target: bounded per-consumer+tool, ≤120s, safe direction — **CONFIRMED bounded**, with the magnitude elevated for explicit sign-off.
4. **Outer-catch (500) does not release the claim** (SEAM F1 / literal D1 / critic) — a throw after the claim but before a charge collects strands the claim for ≤120s; a legit retry within the window gets a false-duplicate marker. **Money-safe** (fails closed) and the correct choice (releasing at a generic post-claim catch would re-open a double-charge when the debit maybe-committed). = ② seal-record residual #3; self-heals at TTL.
5. **Price-change-within-window duplicate served the generic marker not the cached body** (critic M1) — the idem key omits cost (correctly — including it would break dedup across a price change → double-charge); a cost change between original and retry makes the cache read miss → the `{duplicate:true}` marker. Money-safe; never serves a wrong body. Severity LOW.
6. **`duplicateChargeResponse` header contract wobble** (critic M2) — the duplicate omits `X-SettleGrid-Tool`/`-Protocol`/`-Latency-Ms`/`X-Powered-By` a real response sets. Non-money cosmetic; the `X-SettleGrid-Duplicate: true` header already signals the special case. Severity LOW.
7. **Truncation-collision / delimiter smell on the client key** (literal A1/A2) — two client keys sharing the first 255 chars collapse (safe-direction over-dedup); the raw `:`-join is a latent foot-gun only if `consumerId`/`toolId` ever become variable. Severity LOW/defensive.
8. **Failover post-billing sync-throw** (② fast-follow) — theoretical, non-reproducible (§3); a `return await`/build-headers-before-debit would fully close it. Not folded.
9. **Founder-accepted (re-confirmed TRUE of the folded code):** Redis-outage fail-open double-charge (bounded/alerted; ③ F2 removed the *post-recovery* extension of it); false-dedup of intended-identical calls within 120s (missed charge, safe); variable-body-no-header retry not protected.

## 7. Executable gate — GREEN on the folded bytes
Authoritative re-run from clean (cwd `apps/web`, matches `web-ci`):
```
npx tsc -p tsconfig.json --noEmit   → exit 0
npm run lint                        → exit 0 (warnings only, pre-existing)
npx vitest run                      → exit 0 · 222 files · 5103 passed · 0 skip · 0 fail
```
Normalized digest: `exit=0 · files=222p/0f · tests=5103p/0skip/0f`.
Reconciliation: sealed baseline 5101 → +2 (③ F2 test + ③ C1 test) → **5103**; no file-count change (both added to the existing `proxy-idempotency.test.ts`). Fail-then-pass reproduced for ③ F2 (delSpy RED→GREEN) and teeth-verified for ③ C1 (header-wiring mutation RED→GREEN).

## 8. Defect-class ledger
- **DC-02 (missing idempotency/replay on money rails)** — remains CLOSED (the class this chunk closed).
- **DC-06 (idempotent-writer inverse trap)** — **RECURRENCE, FOLDED at ③.** The seal validated "release only at known no-charge exits, never after a charge"; ③ F2 found the *complementary* gap: **release only by the OWNER of the claim** — a non-winner (fail-open) must not release a key it never set. Ledger note: an ownerless `del` on a shared key is a DC-06 recurrence; gate releases on proven ownership (won-claim, or a fencing token).
- **DC-24 (false-green / toothless control)** — reinforced: the new public boundary (client header) gained behavioral teeth (③ C1); a latent select-queue leak in the harness was fixed.
- **SEAM / LITERAL-EXECUTION** — no new recurrence; both lenses returned load-bearing-sound at integrated scope.

## 9. Commit manifest (explicit pathspec — never `git add -A`)
**INCLUDE (the ③ fold):** `apps/web/src/app/api/proxy/[slug]/route.ts` · `apps/web/src/lib/proxy-idempotency.ts` · `apps/web/src/app/api/proxy/[slug]/__tests__/proxy-idempotency.test.ts` · this record (`docs/tech-debt/proxy-idempotency-keys-postseal-deepaudit-2026-07-01.md`).
**EXCLUDE (pre-existing, leave untouched):** `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-2026-06-15-*.md`, `.claude/`, `launch-gate-queue.md`, `LAUNCH-GATE-roadmap-2026-06-27.md` (gitignored), `v-n3-mfa-*`, `mfa-delete-smoke.sh`, the other chunks' `*-deepaudit-*.md`.
Roadmap G3-3 stays `☑` (already ticked at ②; no gate-count change — ③ hardens, does not open/close a blocker).

## 10. Verdict
**RE-CERTIFIED (hardened).** The money invariant is SOUND at integrated scope (exactly-once; all three debit sites behind the single claim; no release-after-charge; concurrent identicals serialize to one debit; tri-state disambiguates duplicate from outage). One confirmed latent double-charge (③ F2, the post-recovery ownerless-`del` extension of the fail-open envelope) is **closed fix-first** with a minimal, invariant-documented change and a live fail-then-pass repro; the header boundary gained behavioral teeth (③ C1). All other reviewer findings are money-safe, pre-existing/not-widened, or operational (§P/§S) — documented, not folded. Two items for the promotion checklist: **Redis `noeviction` posture (§6.2)** and **poll-collapse revenue sign-off (§6.3)**.
