# (K) HMAC-pepper for the API keyspace — CHUNK HANDOFF (2026-06-08)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> SettleGrid authenticates the **money proxy** + all SDK metering + publisher publishing by **hashing API
> keys** and looking up the hash. (K) hardens that hash from a bare SHA-256 to an **HMAC-SHA256 with a
> server pepper + domain tag** (register DEBT #3, DE-recommended). The founder lifted the gate 2026-06-08.
> **TIER: HIGH-STAKES** (security/crypto boundary on the money path + a deliberate edit to a frozen surface
> + likely a migration). Full gate discipline: scope-confirm trace → build plan → deep INDEPENDENT pre-build
> audit (PLAN_READY, 0 blocking, all fixes) BEFORE any code → single-writer build → executable gate →
> seal-gating review → SEAL + founder-gated commit. NOTHING ships (push / prod-env / migration apply /
> publish) without the founder's explicit word.

---

## 0. Why now + what (K) is

Register DEBT #3 (`publisher-api-keys-audit-2026-05-28.md`): *"Unsalted shared SHA-256 keyspace across
consumer (`sg_live_`) + publisher (`sg_pub_`) keys; no pepper/HMAC, no domain tag … Negligible collision
risk (256-bit), so not exploitable today. No defense-in-depth if DB disclosed. Fix:
`HMAC-SHA256(serverPepper, "pub:"+key)` for new keys (needs dual-read/migration for existing). Affects
consumer keys too."*

**Threat model:** if the `key_hash` column is disclosed (DB leak/backup), bare SHA-256 hashes are offline-
guessable for any low-entropy or known-structure keys, and there's no server-side secret gating
verification. An HMAC with a server-held pepper means a DB-only disclosure is **useless without the pepper**.
This is **defense-in-depth**, not a live exploit fix (the keys are 256-bit random, so collision/preimage is
already infeasible) — so the value is the DB-disclosure posture, and the **risk of the change** (breaking
auth on the money path) dominates the risk it mitigates. **Get the dual-read exactly right or you cause the
outage you were hardening against.**

**Source-of-truth used to derive scope (read these):**
- The register item: `docs/tech-debt/publisher-api-keys-audit-2026-05-28.md` (DEBT #3 + the (R)/(N) updates).
- The gated-menu framing: `docs/tech-debt/next-chunk-handoff-2026-06-07-post-c.md` §"remaining menu".
- The frozen-surface precedent: every prior build plan/seal lists `lib/crypto.ts hashApiKey + key formats`
  as byte-stable (`h-f1-build-plan-2026-06-08.md`, `c-…-build-plan-2026-06-07.md`). (K) is the one chunk
  that deliberately edits it.

---

## 1. TIER: **HIGH-STAKES** (record in the plan; later phases inherit it)

Triggering criteria met (multiple):
- **Touches a security/correctness boundary** — `hashApiKey` is the auth mechanism for `proxy/[slug]` (the
  on-chain settlement proxy), all `sdk/*` metering, and `tools/publish`. A wrong hash = a 401 on real money.
- **Changes/adds an invariant** — the key-verification contract (presented key → stored hash match) changes
  from single-hash to dual-hash; a new secret (the pepper) becomes load-bearing for all auth.
- **Edits a FROZEN surface** — `lib/crypto.ts hashApiKey` + key formats are on the byte-stable spine of
  every prior chunk. This chunk edits it on purpose.
- **Likely a migration** (generated-not-applied, founder-gated) if new rows are scheme-tagged; and a
  **prod env change** (the pepper secret) that is founder-gated.
- **Affects a gate** — the crypto test suite (`crypto.test.ts`, `crypto.extended.test.ts`) + ~7 route tests.

→ **HIGH-STAKES.** Pre-build audit = FULL lens set + adversarial verification per finding (§5).

---

## 2. The 1–2 LOAD-BEARING decisions most likely to be SILENTLY WRONG
> (Where the audit's judgment must concentrate — choices that pass every test yet are incorrect in prod.)

**LB-1 — "Dual-read", because existing keys CANNOT be re-hashed; and it must cover EVERY verify site,
including a HIDDEN inlined one.**
  - The raw key is **never stored** (only its hash). An HMAC is keyed, so **you cannot recompute an HMAC
    from a stored SHA-256** → **existing `key_hash` rows can never be bulk-migrated to HMAC.** A plan that
    says "a migration re-hashes existing keys" is **impossible and wrong.** Existing keys can only be
    (a) left as SHA-256 forever and matched by **dual-read** (compute both `sha256(key)` and `hmac(key)`,
    look up either), or (b) **lazily upgraded on successful legacy verify** (UPDATE the row to the HMAC
    hash on next use).
  - **Sub-decision (judge in the plan):** pure dual-read (no writes; simplest; SHA-256 rows persist) vs.
    lazy-upgrade-on-verify (eventually retires SHA-256 but adds a **WRITE on the `proxy/[slug]` hot read
    path** + a unique-index/concurrency hazard + a funds-path side effect). Recommendation to pressure-test:
    **pure dual-read** (behavior-neutral on the hot path; the DB-disclosure posture is identical for new
    keys either way). Whichever is chosen, the legacy path must stay correct.
  - **The hidden site:** verification happens at **6 sites across 2 code paths** — 5 consumer sites via
    `hashApiKey` (`proxy/[slug]:136`, `sdk/validate-key:40`, `sdk/meter:60`, `sdk/meter-with-metadata:53`,
    `sdk/test-validate:36`) AND **`tools/publish/route.ts:172`, which does NOT call `hashApiKey` — it
    inlines `createHash('sha256').update(rawKey).digest('hex')`.** If the chunk centralizes the new scheme
    but misses the inlined copy, **publisher publish-key auth breaks or silently stays SHA-256 while
    consumer keys move to HMAC** — green on most tests, broken in prod. The plan must de-inline this (route
    it through the shared helper) and apply dual-read here too.
  - **Failure mode if wrong:** any verify site not made dual-read returns 401 for keys hashed under the
    *other* scheme → a silent auth outage on the money/publish path, surfacing only for affected keys.

**LB-2 — The pepper's provenance, domain separation, and missing/rotation fail-mode (must FAIL-CLOSED, not
silently unkeyed).**
  - **Source:** an env secret (e.g. `API_KEY_PEPPER`) via a `requireEnv`-backed accessor in `lib/env.ts`
    (convention: `getCronSecret`/`getRedisUrl`). It must be set in **every** environment (local/preview/
    prod) **before any HMAC key is issued or verified** — a **founder-gated prod env change**.
  - **Missing-pepper fail-mode (the silent-wrong crux):** a missing/empty pepper must **NOT** silently fall
    back to unkeyed SHA-256. That would (i) defeat the security goal and (ii) compute the *legacy* hash for
    a *new* key → mismatch → outage anyway. Auth is **not** anti-abuse, so — unlike H1's rate-limiter
    fail-OPEN — the pepper should **fail-closed / boot-assert** (a present-but-wrong or absent pepper is a
    deploy error, not a soft-degrade). Decide + justify; do NOT inherit H1's fail-open stance here.
  - **Domain separation:** the sketch is `HMAC(pepper, "pub:"+key)` — bind the **key class** into the HMAC
    (`live:` for consumer / `pub:` for publisher) so a consumer key can never be replayed against the
    publisher table or vice-versa. Confirm the domain tag is applied identically at **generate** and
    **verify** for each class (a mismatch = that class can't authenticate at all).
  - **Rotation:** rotating the pepper invalidates every HMAC key (a second dual-read dimension or a forced
    re-issue). Implementing rotation is **OUT**, but the scheme must not preclude it; document the residual.

⚠️ **The two judged calls are LB-1 and LB-2.** Everything else is a behavior-neutral mechanical refactor.

---

## 3. DECIDED-AT-TRACE scope (in / out) + SCOPE GUARD

**In scope (confirm exact shape in the trace + plan):**
1. **`lib/crypto.ts`:** add an HMAC hasher (e.g. `hashApiKeyHmac(key, domain)` =
   `HMAC-SHA256(pepper, domain + ':' + key)` hex) + keep the legacy `hashApiKey` (bare SHA-256) for
   dual-read. `generateApiKey` / `generatePublisherApiKey` emit the **HMAC** hash for new keys (with the
   correct domain). **Key FORMATS unchanged** (`sg_live_`/`sg_pub_` prefixes + lengths byte-identical).
2. **`lib/env.ts`:** the pepper accessor (`getApiKeyPepper()`), fail-closed semantics per LB-2.
3. **Dual-read at all 6 verify sites** (5 consumer + the de-inlined `tools/publish`), via a shared verify
   helper so the dual-read logic lives in ONE place (avoid re-introducing an inlined divergence).
4. **(Maybe) a generated-not-applied migration** — ONLY if new rows are scheme-tagged (an optional nullable
   `hash_scheme`/`hash_version` column). Pure dual-read needs **no** schema change; the trace decides. If
   added: hand-written per the 0002-0014 convention, generated-not-applied, founder-gated.
5. Tests (incl. fail-pre-fix for the new behavior) + docs (capstone, register close DEBT #3, handoff, memory).

**OUT of scope (byte-stable unless the trace proves a PLANNED change requires it):** the key **formats**
(`sg_live_`/`sg_pub_`, lengths, prefixes, display-prefix slicing); the auth GATES' contract (same 401/200,
same lookup semantics — only the hash computation changes); pepper **rotation** + key **re-issue** flows;
applying any migration / setting the prod pepper env (founder-gated); the settlement/ledger/reconciler
(incl. the just-shipped (H) guard + the (C) take model); `lib/rate-limit.ts` (incl. the (F1) `sessionLimiter`);
`lib/pricing.ts`; `lib/payouts/**`; the meter CREDIT path; `deductCreditsRedis` / balance authority / dedup /
B4 `account_id`; x402/ap2/circle-nano adapters; ALL `packages/mcp`; ALL `packages/sdk-python*`; F1/F2/F3/F4/
N/M/H1/R/(C)/(H) settled designs. **Reject scope creep, gold-plating, deferred-work pull-in.** On this
boundary, "provably auth-neutral for existing keys + HMAC-only for new keys, at every verify site" is the bar.

---

## 4. Ground state + pre-flight (verify before touching anything)

- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `ede13b8b`** = the just-landed (H)+(F1) local commit,
  **atop `origin/main` = `839455fb` (deployed prod), NOT pushed.** (K) is a **fresh local commit atop
  `ede13b8b`** — it stacks on the unpushed (H)+(F1), same as the prior N→F2→F4→R→C local stack. Confirm:
  `git -C /Users/lex/settlegrid log -3 --oneline && git status -sb`.
- **Baselines (re-run to anchor BEFORE any edit; end-state keeps them green + only this chunk's deltas):**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4301 pass / 184 files**) · `npx next
    build` (**0**; not concurrent with tsc) · `npx eslint <changed files>` (0).
  - `cd packages/mcp`: `npx vitest run` (**1898 pass / 1 skip**) — expected byte-stable.
  - Python family (`packages/sdk-python*`): expected byte-stable (`git diff --numstat`). **NOTE:** the TS
    SDK `@settlegrid/mcp` sends an `X-Api-Key` header (F2) but does NOT hash — hashing is server-side only,
    so the SDK packages should be untouched. Confirm in the trace.
- **DB note:** prod schema is post-0014 (no `revenue_share_pct`). The keyspace tables are `api_keys`
  (`key_hash text NOT NULL`, unique idx `api_keys_key_hash_idx`, schema.ts:250/263) + `developer_api_keys`
  (`key_hash`, unique idx `developer_api_keys_key_hash_idx`, schema.ts:292/302). DB access **read-only**; any
  schema change is a **generated-not-applied** migration, founder-gated.
- **Real-money guardrails:** do NOT push, set/change prod env (incl. the new pepper secret), **apply**
  migrations, or publish (all founder-gated). Generating a migration FILE is fine; applying it is not.
- **Shell is zsh:** quote bracketed paths (`'apps/web/src/app/api/proxy/[slug]/route.ts'`).

---

## 5. THE ARC — phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code

### Phase 1 — scope-confirm DISCOVERY TRACE (no plan without it)
Write `docs/tech-debt/k-hmac-pepper-trace-2026-06-08.md`. Re-derive every §0–§4 claim against live code,
each grounded in a file:line read THIS session. Nail: **(a)** the EXACT verify-site set — every `hashApiKey`
caller AND every inlined `createHash('sha256')`/keyed-hash over an API key (grep both; the publisher inline
at `tools/publish:172` is the known trap; prove there are no others); **(b)** the dual-read decision (pure
dual-read vs lazy-upgrade-on-verify) with the hot-path/concurrency analysis; **(c)** the pepper source +
fail-closed semantics + the domain-tag binding (`live:`/`pub:`) at generate AND verify; **(d)** whether a
schema change (scheme-tag column) is actually needed or pure dual-read suffices (prefer no migration);
**(e)** the exact test sweep (the 9 crypto/route test files + which assert a specific SHA-256 digest that
the new scheme changes — those are forced edits; a test that pins `hashApiKey('x') === '<sha256 hex>'` is a
behavior pin, not a forced break, since legacy `hashApiKey` is KEPT); **(f)** that key FORMATS are
untouched; **(g)** SDK/mcp/python untouched (server-side hashing only).

### Phase 2 — BUILD PLAN (status DRAFT until the audit passes)
Write `docs/tech-debt/k-hmac-pepper-build-plan-2026-06-08.md`: goal + honest framing (defense-in-depth, not
a live-exploit fix; the change-risk dominates) + the TIER; the resolved LB-1/LB-2 with proofs; EXACT per-file
recipes; the **dual-read verify flow** (worked: a legacy-SHA row and a new-HMAC row both authenticate; a
wrong-domain or wrong-pepper key does NOT); the pepper accessor + fail-closed proof; the de-inlining of
`tools/publish`; any migration (generated NOT applied) OR an explicit "no schema change" justification; the
behavior-change tests that **FAIL pre-fix** (new key verifies under HMAC; missing pepper fails closed) and
the behavior-neutral regression pins (legacy keys still verify); the byte-stable spine list (§3) + SCOPE
GUARD; the machine gates (tsc 0 / vitest 4301 + exact N_new / build 0 / eslint 0; mcp 1898/1; `git diff
--numstat` confined; python byte-stable); the deploy/rollout note (**pepper env must be set in prod BEFORE
new keys are issued; dual-read makes the deploy safe for existing keys; ordering matters**).

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the hard gate; sized to HIGH-STAKES)
**No implementation code until the plan is audited PLAN_READY (0 blocking) with ALL fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt `.audit/h-prebuild/prebuild-audit.mjs`
  → `.audit/k-prebuild/prebuild-audit.mjs` — **keep its hardened tail VERBATIM** (null-guard + inline
  degraded fallback so a dead synthesizer can never crash the run or fake a pass). Shape: N fresh-context
  lenses re-derive the plan's claims against actual code → **adversarial verify** of every finding
  (default-refuted) → guarded synthesis at PLAN_READY / 0 blocking.
- **MECHANICAL-FIRST (required):** BEFORE the fan-out, settle every mechanically-checkable claim with a
  deterministic script/probe and feed the results in. Concretely: run the gates (tsc/vitest/build/eslint;
  mcp); and write probes for — the EXACT verify-site set (grep every `hashApiKey` caller + every
  `createHash('sha256')`/HMAC over a key var; assert the set == the planned dual-read set, so the inlined
  publisher site can't be missed); a dual-read correctness probe (build a legacy `sha256(key)` row + a new
  `hmac(pepper, domain+key)` row in a throwaway harness; prove the dual-read lookup matches BOTH, and that a
  wrong-pepper / wrong-domain key matches NEITHER); the key-FORMAT-unchanged assertion (`sg_live_`/`sg_pub_`
  + lengths); the test sweep file set; the suite arithmetic. **Keep mechanical checks as scripts, not model
  calls.**
- **HIGH-STAKES lens set (full) — suggested ~7:** (a) **factual accuracy** (every file:line + the verify-site
  map incl. the inlined publisher); (b) **crypto correctness** — the HMAC construction, domain separation,
  and that new keys verify only under HMAC; (c) **dual-read completeness** — EVERY verify site (consumer +
  publisher) authenticates both legacy and new keys; no site left single-scheme; the de-inlining is complete;
  (d) **pepper fail-mode + secret hygiene** — missing/empty pepper fails CLOSED (not silently unkeyed), the
  pepper is never logged/returned, rotation residual documented; (e) **migration safety** (if a scheme-tag
  column is added) OR the no-migration justification; (f) **scope / zero-out-of-spine** — key formats + the
  settlement/rate-limit/pricing/payouts/mcp/sdk-python spine untouched; the ONLY behavior change is the hash
  scheme; (g) **test sufficiency** — behavior-change tests fail pre-fix; legacy-key regression pinned; sweep
  exact; arithmetic exact. **Run every reasoning role on the most capable model.**
- **Run twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 must be PLAN_READY 0-blocking.
  The implementer re-confirms every sustained finding LIVE before folding it; all fixes land before any build.
- **DEGRADED-RUN GUARD:** `deadLenses>0` / `nullVerdicts>0` / `degraded=true` is **NOT a pass.** On transient/
  session-limit death, back off ~4 min + re-run; `Workflow({scriptPath, resumeFromRunId})` replays cached
  agents after a partial death.
- **Charge each reviewer in ISOLATION** (its lens only, never the cadence/seal/other phases). **Guard the
  spine** (reject scope creep / gold-plating / deferred-work pull-in / rotation-implementation / key-reissue).
  **Defer NO finding — this phase is the last line of defense.**
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the seal):** Objective
  confidence, NOT finding-count. **Zero findings is a valid outcome.** A finding that grows scope is
  `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong. Hold the line
  against: changing key FORMATS; implementing pepper rotation or key re-issue; touching the settlement/
  reconciler/(H)-guard/(C)-take, rate-limit/(F1), pricing/payouts, meter-credit, `deductCreditsRedis`, B4
  account_id, x402/ap2/circle-nano adapters, `packages/mcp`, `packages/sdk-python*`; re-litigating settled
  designs without a NEW trace; PyPI/npm publishing; applying the migration or setting prod env. Re-opening a
  settled decision requires a concrete new trace.
- Record `.audit/k-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md`.

### Phase 4 — BUILD (single-writer)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit gates only).
Line-surgical; touch only the planned sites. Keep each batch green. Prove fail-pre-fix empirically for the
behavior-change tests (record to `.audit/k-build/`).

### Phase 5 — EXECUTABLE GATE → end the build session with a CADENCE-STATUS report
When tsc 0 / vitest 4301+N_new / build 0 / eslint 0 / mcp 1898-1 / python byte-stable / scope confined — stop
and report CADENCE-STATUS, flagging readiness for the seal-gating review.

### Phase 6 — SEAL-GATING REVIEW + SEAL (0 blocking BEFORE any commit)
A security-posture SEAL (the auth/crypto boundary). Adapt `.audit/h-postbuild/seal.mjs` → `.audit/k-postbuild/
seal.mjs` (keep the hardened tail), with lenses for: crypto correctness of the SHIPPED code; dual-read
completeness across all 6 sites (re-run the probe against the shipped diff); pepper fail-closed + secret
hygiene; scope / zero-out-of-spine (key formats + spine untouched); test integrity (fail-pre-fix, legacy
regression, sweep complete, arithmetic); migration safety (if any) + residual honesty (rotation deferred).
Embed the §Phase-3 SPINE-SAFEGUARD clause VERBATIM. Degraded-run guard + resume. **0 blocking before ANY
commit.** Then (for a HIGH-STAKES chunk) a **post-seal deep audit (③)** of the integrated whole.

### Phase 7 — FOUNDER-GATED CLOSE-OUT
LOCAL commit, path-scoped, atomic (never `git add -A`; quote bracketed paths; founder identity
`Luther Whiting-Collins <lexwhiting@gmail.com>`, trailer `Co-Authored-By: Claude <exact model>
<noreply@anthropic.com>`). **NO push. NO publish. NO migration apply. NO prod-env set.** Then: capstone
(`k-hmac-pepper-resolution-2026-06-08.md`); register UPDATE (close **DEBT #3**); next-chunk handoff; memory.
**Surface to the founder at close:** the pepper env secret must be set in prod (every env) and the migration
(if any) applied — both founder actions — and the deploy ordering (set pepper → deploy code → new keys issue
under HMAC; existing keys keep working via dual-read).

---

## 6. Frozen / existing surfaces to build ON (do not modify; read for shape)
- **Hashing core:** `apps/web/src/lib/crypto.ts` (`hashApiKey` SHA-256 :37; `generateApiKey` :10;
  `generatePublisherApiKey` :25; `API_KEY_PREFIX`/`PUBLISHER_API_KEY_PREFIX` :3-4).
- **Verify sites (consumer, via `hashApiKey`):** `'app/api/proxy/[slug]/route.ts':136` (the MONEY proxy) ·
  `app/api/sdk/validate-key/route.ts:40` · `app/api/sdk/meter/route.ts:60` ·
  `app/api/sdk/meter-with-metadata/route.ts:53` · `app/api/sdk/test-validate/route.ts:36`.
- **Verify site (publisher, INLINED — the trap):** `app/api/tools/publish/route.ts:172`
  (`createHash('sha256').update(rawKey)…` → `developerApiKeys.keyHash` lookup :178). De-inline through the
  shared helper.
- **Creation sites:** `app/api/consumer/keys/route.ts:122` (`generateApiKey` → `api_keys`) ·
  `app/api/dashboard/developer/api-keys/route.ts:124` (`generatePublisherApiKey` → `developer_api_keys`).
- **Storage:** `lib/db/schema.ts` — `apiKeys.keyHash` :250 (+ unique idx :263); `developerApiKeys.keyHash`
  :292 (+ unique idx :302).
- **Env convention:** `lib/env.ts` `requireEnv` :3 (`getCronSecret`/`getRedisUrl` are the accessor pattern).
- **Tests (sweep surface, 9):** `lib/__tests__/crypto.test.ts`, `lib/__tests__/crypto.extended.test.ts`,
  `app/api/__tests__/{audit-logging,test-mode,sdk,sandbox,consumer-api,consumer}.test.ts`,
  `__tests__/smoke.test.ts`.
- **Audit templates (gitignored, on disk):** `.audit/h-prebuild/prebuild-audit.mjs` (hardened tail — keep
  verbatim) · `.audit/h-postbuild/seal.mjs` (seal shape) · `.audit/h-prebuild/CHECKPOINT.md` (recovery).
- **Prior records (context; do not edit):** the (H)+(F1) capstone `h-f1-resolution-2026-06-08.md`; the (R)
  register close-out (which de-inlined the publisher prefix-check at `tools/publish` — note it still inlines
  the HASH); the register `publisher-api-keys-audit-2026-05-28.md`.

## 7. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the audit gates.
- **Ground every conclusion in ACTUAL tool output** (gates run, greps shown, the dual-read proven by a
  probe that matches both a legacy and a new row — no vibes). On this boundary, "I think every key still
  authenticates" is not acceptable — show it.
- **Line-surgical**; §3 byte-stable spine; smaller change wins; the ONLY behavior change is the hash scheme.
- Do NOT push, change prod env (incl. the pepper), **apply** migrations, or publish. DB read-only.
- **Flag context degradation the moment it risks quality** (founder standing order). Consider a fresh session
  per phase (plan → build → seal).

## 8. One-paragraph orientation (read last, then start Phase 1)
SettleGrid verifies an API key by hashing it (bare SHA-256, `hashApiKey`) and looking up the hash in
`api_keys` (consumer `sg_live_`) or `developer_api_keys` (publisher `sg_pub_`). (K) hardens that to
`HMAC-SHA256(serverPepper, domain+":"+key)` so a DB-only disclosure can't be used offline. The work is a
careful refactor of the hashing scheme — **not** a feature — and its danger is entirely in the seams:
existing keys **cannot** be re-hashed (the raw key isn't stored), so verification must **dual-read** (try
both SHA-256 and HMAC) at **every** verify site — including the **inlined `createHash` at
`tools/publish:172`** that bypasses `hashApiKey` and is the easiest thing to miss; and the pepper must come
from a fail-closed env secret with domain separation, never silently degrading to unkeyed. Miss a verify
site or get the pepper fail-mode wrong and you cause a 401 auth outage on the money path — the exact harm
you were hardening against. The two load-bearing, silently-wrong-prone calls are (LB-1) *dual-read across
every site incl. the hidden inlined one + pure-dual-read vs lazy-upgrade* and (LB-2) *the pepper's source,
domain tag, and fail-closed/rotation story.* Start with the trace; trust nothing until you've re-derived it.
