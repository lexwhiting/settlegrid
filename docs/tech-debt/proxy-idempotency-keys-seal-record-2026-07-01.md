# proxy-idempotency-keys — ② SEAL RECORD — 2026-07-01

> **Chunk:** `proxy-idempotency-keys` · **Closes launch-gate blocker:** **G3-3** (idempotency-key gap on the live billing rail) · **Tier:** **HIGH-STAKES** (not escalated)
> **Base:** local `main` HEAD `f77eb2c8` (consumer-abuse-hardening ③ RE-CERTIFIED, PUSHED). Disjoint files.
> **Seal commit:** (this commit) — UNPUSHED (push gated on `/push-go`).
> **Handoff:** `docs/tech-debt/proxy-idempotency-keys-handoff-2026-07-01.md` · **③ post-seal deep audit:** PENDING (high-stakes-warranted).

---

## 1. Seal decision — SEALED (clean)

A client **retry of a timed-out metered proxy call** no longer double-charges. A **tri-state Redis `SET NX EX` charge-idempotency gate** is placed once — after body capture, before the cache check + both upstream forwards — governing **all three** money-debiting sites (cache-hit #1, main #3, SLA-failover #6). On a duplicate the request returns a **2xx marker (or the cached body)** at cost 0 without forwarding or debiting; on a Redis outage it **fails OPEN + pages a `money_loss` alert**; the claim is **released (awaited)** only at known no-charge exits so a legitimate later retry can still charge.

**Money invariant SOUND** (verified by 4 lenses + integrator trace): exactly-once charge for the target case (one request + a byte-identical sequential retry, Redis up); all 3 debit sites behind the single claim; **no release-after-successful-charge path**; two concurrent byte-identical requests serialize on `SET NX` to exactly one debit; tri-state correctly disambiguates duplicate (`SET NX`→null) from outage (`tryRedis`→null). **ZERO reproducible high-severity money-loss findings.**

**No migration / no schema change** (Redis store; DB-durable rejected per FOLD 8). The chunk is `route.ts` (+119) + one `lib/` helper + one `logger.ts` money-loss key + one behavioral+source test.

---

## 2. Executable gate — GREEN on the sealed bytes

Authoritative re-run from clean (cwd=`apps/web`, matching `web-ci` working-directory; the build left NO self-verification manifest → its green was treated as RED and re-run):

```
npx tsc -p tsconfig.json --noEmit   → exit 0
npm run lint                        → exit 0 (warnings only, pre-existing)
npx vitest run                      → exit 0 · 222 files · 5101 passed · 0 skip · 0 fail
```

Normalized digest: `exit=0 · files=222p/0f · tests=5101p/0skip/0f`.
Reconciliation: prior baseline (consumer-abuse ③) 221f/5085p → +1 file (`proxy-idempotency.test.ts`) → 5099 as-built → **+2 fold behavioral tests (cache-hit #1, failover #6) → 5101**. Re-confirmed GREEN at `/seal-go` time.

---

## 3. Review — 5 lens-distinct fresh-context Agent-tool reviewers (all `claude-opus-4-8[1m]`)

Orchestration = Agent-tool spawns (operator-selected: Path-1 pool absent → no `.claude/agents`; a `max` core-invariant lens is mutually exclusive with a single workflow's one-session-effort). Env traps unset (FORK/SUBMODEL/EFFORT). Allowlist GREEN (git/tsc/vitest/lint). Reviewers self-reported **high** (model-unreliable; session-effort fan-out) — **the `max` core-invariant depth is DEFERRED to ③** per the operator's orchestration choice.

Lenses: money/idempotency core-invariant · atomicity/concurrency · spec-conformance · SEAM · literal-execution/test-teeth. **SEAM: 9/9 load-bearing claims verified** against cited primitives (upstash `SET NX`→`'OK'`/`null`; `tryRedis`→null-on-outage; body reused not re-read; `hashBody` == cache-key fn; release awaited vs fire-and-forget siblings; claim precedes both failover call sites; `proxy.idempotency_gate_unavailable` ∈ MONEY_LOSS_KEYS). Spec-conformance: **11/12 PASS**, the 12th (FOLD 9 behavioral teeth) PARTIAL → **FOLDED**.

**Key convergences (the adversarial verification):**
- **Client-key drops `toolId`** — independently flagged by money-core (A) + literal-exec (A1). → FOLD A.
- **DC-24 test teeth** — spec-conformance (item 10) + literal-exec (B3): the failover source-scan is *vacuous* (anchors on the def at line 2779, which the claim can never precede) and #1/#6 have no behavioral teeth. → FOLD B.
- **Exception phantom-claim** — atomicity (F1) + money-core (D) + literal-exec (A2), all agree money-safe / FOLD-8 self-heal.
- **#1/#6 credit-without-collect (DC-01)** — atomicity (F2) + money-core (C), both confirm pre-existing + not widened.

---

## 4. Folds applied — each reproduced fail-then-pass (live)

### FOLD A [MED, convergent] — `chargeIdemKey` client-key path was tool-blind → cross-tool over-dedup
`lib/proxy-idempotency.ts:61-63`: `clientKey ? ${consumerId}:hdr:${clientKey}` dropped `toolId`. A consumer reusing one `Idempotency-Key` across two DIFFERENT tools within the TTL collapsed to one gate → the 2nd tool's call skipped **both** the debit AND the upstream forward, returning a duplicate marker instead of that tool's real response (money-direction-safe but a correctness + developer-revenue break the moment any client adopts the header). **Fix:** scope the client key by tool — `${consumerId}:${toolId}:hdr:${clientKey}`. **Repro:** cross-tool assertion RED (byte-identical keys) → GREEN after fix. New unit assertion pins it (different `toolId` + held `clientKey` → different key).

### FOLD B [MED→DC-24, convergent] — test teeth
- **Vacuous failover source-scan** re-anchored from the function *definition* (`safeFetch(fallback.proxyEndpoint`, line 2779 — always after the claim regardless of flow) to the **call sites** (`attemptFailover({`, first at line 933) — a claim moved below the failover call now flips it RED.
- **Behavioral cache-hit (#1)** and **behavioral SLA-failover (#6)** tests added (partial-mock `@/lib/failover` keeping the real `shouldAttemptFailover` status set; prime `getToolCategory`'s one select). Each drives two identical requests and asserts exactly-one debit + one developer-credit + a 2xx duplicate on the 2nd. **Repro:** neutralized the duplicate-skip in `route.ts` → exactly the 3 dedup behavioral tests (main + #1 + #6) went RED; restored → GREEN.
- **DC-05 mock fidelity:** the Redis mock `get` now deserializes JSON like `@upstash/redis .get<T>()` (was returning a raw string), enabling the cache-path test.
- **Fail-open alert** assertion now pins `costCents` (the at-risk amount for reconciliation), not just `consumerId`.

---

## 5. Documented residuals + fast-follows (NOT folded — out-of-scope, non-reproducible, or founder-accepted)

1. **Failover post-billing throw** (money-core B, HIGH-sev / non-reproducible) — `attemptFailover`'s whole body is inside `try{…}catch{return null}`; a *synchronous* throw between billing (ends 2845) and `return injectAttributionAndReturn(...)` (2899) would return `null` → caller releases → a retry double-charges. **Verified non-reproducible:** `logFailoverEvent` is `logger.info`, `addFailoverHeaders` sets controlled values, the invocations insert is a lazy builder, and the un-awaited `return` makes an *async* rejection reject `attemptFailover` (→ outer catch → no release → money-safe). Empty synchronous throw surface. **Fast-follow (defense-in-depth):** make `attemptFailover` never-return-`null`-after-billing (e.g. wrap the post-billing tail to still return the fallback 2xx).
2. **#1/#6 global-balance debit missing `.returning()` collected-check (DC-01)** — pre-existing; **explicitly DEFERRED** by the handoff ("its own track; FOLD 6 sidesteps needing it"). Diff does not touch 2742-2865; **not widened** by the gate (distinct bodies → distinct keys → both win). Confirmed by atomicity F2 + money-core C. Belongs to the DC-01 settlement-non-atomicity track.
3. **Exception phantom-claim → false-2xx on retry** (money-core D / atomicity F1 / literal A2) — money-SAFE (never double-charge; releasing on an ambiguous debit-exception would re-open a double-charge when the debit maybe-committed). Self-heals in ≤120s (FOLD 8). Sharpest edge: a retry after a transient-DB-error 500 gets a 2xx duplicate marker — inherent to claim-before-completion without stored-response replay (out of scope).
4. **Header-presence asymmetry** (money-core E) — original without a header (server-derived key) + retry with one (or vice-versa) → different keys → double charge. Requires the client to change header presence between attempts (residual family (d), variable-input). Folding needs a non-minimal dual-key check — not folded.
5. **Fail-open boundary** (money-core F) — precisely "Redis outage during *either* request in the pair," not strictly "outage ∩ retry." Bounded + alerted (`proxy.idempotency_gate_unavailable`, logs `consumerId/toolId/costCents/requestId`). **Whether the alert actually PAGES depends on Sentry/log-alerting config** → a §S/§P operational item, not code-closeable.
6. **GET/query poll-collapse** (SEAM + spec) — a metered GET (empty body, query not forwarded) yields a constant key per consumer+tool → identical polls within the TTL collapse (cacheable → served the paid-cache body free; `cacheTtl=0` → the `{duplicate:true}` marker). **Documented, founder-accepted** (FOLD 4a); opt-out via a varying `Idempotency-Key`.

**Founder-accepted residuals from the handoff (re-confirmed TRUE of the built code, not worse):** Redis-outage fail-open double-charge (bounded/alerted); false-dedup of intended-identical calls within the 120s TTL (missed charge, safe); variable-body-no-header retry not protected.

---

## 6. §P / §S pre-promotion items (NOT code-closeable)
- **§S live smoke:** a metered call that times out client-side and is **retried with the same body charges exactly once** (and a distinct body charges again). Confirm on the api-key rail.
- **§S/§P:** confirm the `money_loss` alert channel (`proxy.idempotency_gate_unavailable`) actually pages under a Redis outage (Sentry `money_loss` tag routing) — residual 5 rests on it.

---

## 7. Defect-class ledger
- **DC-02 (missing idempotency/replay on money rails)** — **CLOSED** by this chunk (the canonical gate: an atomic `SET NX` claim before the write, empty-means-skip).
- **DC-06 (idempotent-writer inverse trap)** — VALIDATED: release only at known no-charge exits, awaited, never after a charge, never on a debit-time CAS-miss; 120s TTL self-heals ambiguous exits.
- **DC-24 (false-green / toothless control)** — **RECURRENCE, FOLDED**: the failover source-scan was vacuous (anchored on the far-below definition) + #1/#6 lacked behavioral teeth. Now behavioral RED-without/GREEN-with at all 3 sites + a call-site-anchored scan. (Consistent with the DC-24 pattern — source-scans that assert position of a later-defined symbol are toothless.)
- **DC-05 (test-double surface divergence)** — RECURRENCE, FOLDED: the Redis mock `get` now deserializes JSON like the real client.
- **SEAM** — clean this chunk (9/9 verified); no new recurrence.

---

## 8. Commit manifest (explicit pathspec — never `git add -A`)
**INCLUDE:** `apps/web/src/app/api/proxy/[slug]/route.ts` · `apps/web/src/lib/proxy-idempotency.ts` · `apps/web/src/lib/logger.ts` · `apps/web/src/app/api/proxy/[slug]/__tests__/proxy-idempotency.test.ts` · `docs/tech-debt/proxy-idempotency-keys-handoff-2026-07-01.md` · `docs/tech-debt/proxy-idempotency-keys-seal-record-2026-07-01.md`.
**EXCLUDE (pre-existing, leave untouched):** `dashboard/tools/page.tsx`, `SECURITY-INCIDENT-2026-06-15-*.md`, `.claude/`, `launch-gate-queue.md`, `LAUNCH-GATE-roadmap-2026-06-27.md` (gitignored — G3-3 ticked locally), `v-n3-mfa-*`, `mfa-delete-smoke.sh`, the other chunks' `*-postseal-deepaudit-*.md`.

Roadmap: **G3-3 `☐→☑`** (gitignored → local; PostToolUse recount 13→12, gate still **RED**).
