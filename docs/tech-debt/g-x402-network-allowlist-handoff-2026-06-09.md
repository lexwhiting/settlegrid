# (G) x402 settle-surface network-allowlist hardening — CHUNK HANDOFF (2026-06-09)

> **Self-contained handoff for a FRESH session. Read end-to-end before touching anything.**
> SettleGrid's x402 rail settles real USDC via the EIP-3009 engine (`settleExactPayment`). Several x402
> network surfaces advertise/accept **`eip155:1` (Ethereum mainnet)**, but the settlement **reconciler's
> confirm engine is Base-only** (`SUPPORTED_CHAINS = {eip155:8453, eip155:84532}`). (G) makes every x402
> network surface derive from **one canonical "settleable + confirmable" allowlist**, so no surface can
> advertise, accept, or settle a network the system can't confirm — closing the B1.4 carried debt
> *"non-Base settlements are UNCONFIRMABLE → stuck pending forever"* **before** a public facilitator is enabled.

---

## 0. Why now + what (G) is

Derived from the source-of-truth chain (scope-confirm 2026-06-09): the post-(C) menu's non-gated queue is
drained ((H)+(F1)+(K) shipped+live; register #2/#4/#5 already fixed; (A) ACP BD-gated; P5 Tier-1 AP2 +
circle-nano done, ACP/UCP credential-gated, Tier 2/3 partner-gated). The one remaining **autonomous,
substantive** money-path item is the **B1.4 carried debt** (authority: `docs/tech-debt/b1.4-settlement-
reconciler-2026-05-31.md` + the B1 memory banner): *"non-Base settlements (e.g. `eip155:1`) are UNCONFIRMABLE
by the reconciler (`SUPPORTED_CHAINS` is Base-only) → stuck pending forever — add Ethereum confirm support OR
**reject non-Base x402 BEFORE enabling a facilitator**."* The founder greenlit the **reject** path.

**The realized gap (verified in code this session):** the network allowlists DISAGREE across surfaces —
- `USDC_ADDRESSES` (`lib/settlement/x402/types.ts` **and a duplicate in `packages/mcp/src/adapters/x402.ts`**)
  = `{eip155:8453, eip155:84532, eip155:1}` — **includes Ethereum mainnet.**
- `PUBLIC_FACILITATOR_NETWORKS` (`api/x402/facilitator/v1/_shared.ts`) = `{eip155:8453, eip155:84532}` — Base-only.
- `SUPPORTED_CHAINS` (`lib/settlement/circle-nano/settle-engine.ts:37`, the reconciler's confirm engine) =
  `{eip155:8453, eip155:84532}` — Base-only.
- `X402_MAINNET_NETWORK` (`lib/env.ts:201`) = `'eip155:8453'` — the F2 production hard-pin.

So `eip155:1` is advertised (`/api/x402/supported` maps raw `USDC_ADDRESSES`) and **acceptable at the unguarded
standalone `/api/x402/settle`** route, yet unconfirmable. The chunk aligns these to one source of truth and
rejects non-confirmable networks at the settle boundary.

**INTENT (why / who consumes / what it enables):** *Why:* close the last funds-integrity gap that stands
between today's deployment and safely enabling a **public x402 facilitator** — today a non-Base settlement can
be advertised, accepted, and (on the standalone route) attempted, yet can never be confirmed by the reconciler,
so money state would wedge `pending` forever. *Who consumes the result:* (1) the **founder's future operator
action** of setting `X402_FACILITATOR_URL` / opening the facilitator surface to outside SDK consumers — (G) is
its explicit prerequisite (B1 carried-debt item 2: "reject non-Base x402 BEFORE enabling a facilitator");
(2) external x402 clients reading `/api/x402/supported` + the facilitator `/v1/supported`, who must see only
networks the platform can actually settle AND confirm; (3) the reconciler, which after (G) never receives an
x402 row it structurally cannot confirm; (4) future chunks via the no-drift invariant test, which makes the
three network sets impossible to silently diverge again. *What it enables:* facilitator-mode go-live becomes a
pure operator decision with no known funds-integrity precondition; and the B1.4 sticky-row population loses its
`eip155:1` source entirely (the remaining starvation machinery stays a separate, at-scale chunk).

---

## 1. TIER: **HIGH-STAKES** (record in the plan; later phases inherit it)

Triggering criteria met (multiple):
- **Security/correctness boundary on the MONEY path** — `/api/x402/settle` calls the real `settleExactPayment`
  (broadcasts a USDC `transferWithAuthorization` via the gas wallet). An unguarded settle on a network the
  reconciler can't confirm is a funds-safety + reconciliation-integrity gap.
- **Adds/changes an INVARIANT** — a new cross-surface invariant: *every x402 advertise/accept/settle surface
  only admits networks in the canonical settleable+confirmable allowlist.*
- **Edits a FROZEN surface (even additively)** — `USDC_ADDRESSES` is **duplicated on the `packages/mcp`
  byte-stable spine** (`adapters/x402.ts`). Any change touching/aligning it edits the frozen mcp surface.
- **Affects a GATE** — the x402 route + settlement suites (`apps/web`) + `packages/mcp`.

→ **HIGH-STAKES.** Pre-build audit = FULL lens set + adversarial verification per finding (§5).

**SCOPE DECISION (sized 2026-06-10 against current capability — record verbatim):** **(G) stays as planned.**
It is already the largest coherent chunk on this seam — the canonical-allowlist unification + the settle-boundary
guard + the advertisement fix + the no-drift invariant are ONE invariant with one "done." Two adjacent items were
evaluated for merge and **rejected**: (a) **B1.1 circle-nano enable-gate split** (`CIRCLE_NANO_API_KEY` vs
`isCircleNanoKernelEnabled`) — an unrelated INCREMENTAL item on a different rail; folding it would dilute the
high-stakes audit's focus on the x402 settle boundary (forbidden merge class). (b) **B1.4 starvation-at-scale**
(`last_reconciled_at` watermark/cooldown + pending-age alert) — a different invariant (batch fairness, not
network admission), explicitly "before high volume" (facilitator is off; volume minimal), requiring a MIGRATION
(G is migration-free), and touching the reconciler internals that (G)'s audit deliberately holds byte-stable;
note (G) already removes the `eip155:1` sticky-row source at origin. **One rider accepted:** the (K)
register/capstone still say "PUSH HELD" (stale — (K) is live); Phase-7's commit carries that docs-only tidy
(no audited scope, no code).

---

## 2. The 1–2 LOAD-BEARING decisions most likely to be SILENTLY WRONG
> (Where the audit's judgment must concentrate — choices that pass every test yet are incorrect in prod.)

**LB-1 — The single canonical allowlist + covering EVERY surface (the completeness trap).**
  There are **at least four** network lists today (`USDC_ADDRESSES` ×2 [app + mcp], `PUBLIC_FACILITATOR_NETWORKS`,
  `SUPPORTED_CHAINS`, plus the `X402_MAINNET_NETWORK` pin). The fix must establish **ONE** source of truth for
  *"settleable + confirmable networks"* and route every surface through it — but the **silently-wrong risk is
  missing a surface.** The enumerated surfaces a presented network flows through:
  - **advertise:** `/api/x402/supported` (maps raw `USDC_ADDRESSES` → leaks `eip155:1`); `/api/x402/facilitator/
    v1/supported` (already filters to `PUBLIC_FACILITATOR_NETWORKS`); the proxy's 402-challenge `payTo`/network
    advertisement (`generateX402_402Response`, `x402-proxy.ts`).
  - **accept/settle:** `/api/x402/settle` (**UNGUARDED** — `network: z.string().min(1)`, no allowlist, calls
    `settleExactPayment`); `/api/x402/facilitator/v1/settle:78` (already rejects non-`PUBLIC_FACILITATOR_NETWORKS`);
    the proxy in-request path (F2-pinned at `proxy/[slug]:1860`); `circle-nano/settle:165` (F2-pinned).
  - **confirm:** the reconciler's confirm engine (`SUPPORTED_CHAINS`) — the ground truth for "confirmable."
  - **the mcp copy:** `packages/mcp/src/adapters/x402.ts` `USDC_ADDRESSES` — a SEPARATE list (frozen spine);
    decide whether it must change (it drives adapter-side validation) or stays and the app filters downstream.
  **Failure mode if wrong:** any one surface still admitting `eip155:1` while the others don't → the exact
  advertise-but-can't-confirm inconsistency, or an unguarded real-money settle on Ethereum. The audit must
  ENUMERATE every x402 network surface (grep-proven) and prove the chosen guard covers ALL of them.

**LB-2 — REJECT-at-the-settle-boundary (not advertisement-only) WITHOUT breaking Base mainnet, Base Sepolia,
the F2 pin, or the facilitator pin.**
  - The guard must reject non-confirmable networks at the actual **settle** boundary (esp. the unguarded
    `/api/x402/settle`), **not merely stop advertising** them — a client can post any network regardless of
    what `/supported` lists. Advertisement-only is a false fix.
  - But the guard must **NOT** break: the legit **Base mainnet** settle path; **Base Sepolia** (`eip155:84532`,
    used by the e2e/test harness + allowed in non-prod via `isX402TestnetSettlementAllowed`); the existing
    **F2 production hard-pin** (prod is mainnet-only even on the proxy); or the facilitator's existing
    `PUBLIC_FACILITATOR_NETWORKS` gate. The **silently-wrong risk:** a guard too narrow (misses `/api/x402/
    settle` → money moves on Ethereum) or too broad (rejects Base Sepolia → breaks the e2e suite; or rejects
    mainnet → breaks live settlement). Decide the canonical set's relationship to `isX402TestnetSettlementAllowed`
    + `isProduction()` explicitly (prod: mainnet-only; non-prod: mainnet + sepolia), mirroring F2.

⚠️ **The two judged calls are LB-1 (completeness across every surface incl. the mcp copy) and LB-2 (reject at
the settle boundary, prod/non-prod-correct, without breaking the legit Base paths).**

---

## 3. DECIDED-AT-TRACE scope (in / out) + SCOPE GUARD

**In scope (confirm exact shape in the trace + plan):**
1. A **canonical settleable+confirmable network allowlist** (single source of truth) — likely derived from /
   co-located with `SUPPORTED_CHAINS` (the confirm engine's set) since "confirmable" is the binding constraint;
   prod/non-prod aware (mainnet-only in prod, +sepolia in non-prod, mirroring F2 `isX402TestnetSettlementAllowed`).
2. **Guard `/api/x402/settle`** (the unguarded standalone route) — reject a network not in the canonical set,
   BEFORE `verifyExactPayment`/`settleExactPayment` (so no money moves on a non-confirmable network).
3. **Fix `/api/x402/supported`** advertisement — filter `USDC_ADDRESSES` to the canonical set (stop advertising
   `eip155:1`), matching what `/api/x402/facilitator/v1/supported` already does.
4. **Decide the `USDC_ADDRESSES` `eip155:1` entry's fate** — remove it, OR keep it (data table) but ensure ALL
   consume-sites (app + the mcp copy) filter to the canonical set. The trace decides; prefer the minimal change
   that closes every surface.
5. **Verify (don't necessarily change)** the already-guarded surfaces (facilitator v1, proxy F2, reconciler
   graceful `unsupported-network`) stay consistent with the canonical set; add a test that pins
   `PUBLIC_FACILITATOR_NETWORKS ⊆ canonical` and `canonical ⊆ SUPPORTED_CHAINS` (no drift).
6. Tests (incl. fail-pre-fix: an `eip155:1` settle is rejected; `/api/x402/supported` omits `eip155:1`) + docs
   (capstone, register/B1.4 debt close, handoff, memory).

**OUT of scope (byte-stable unless the trace proves a PLANNED change requires it):** the **ADD-Ethereum-confirm**
alternative (extending the reconciler to confirm `eip155:1` — explicitly the rejected B1.4 option; reject is
the founder choice); the EIP-3009 settle ENGINE internals (`settleExactPayment`/`executeX402Settlement` logic,
nonce, gas wallet); the reconciler's confirm/credit math (`reconcileOneRow`/`creditSettlement` — only its
`SUPPORTED_CHAINS` set is the reference); the F2 production hard-pin behavior (proxy stays mainnet-only — do
NOT loosen); the (H)-guard / (C)-take / (K)-keyspace / rate-limit / pricing / payouts / meter-credit;
ap2/circle-nano adapters EXCEPT their shared network-pin pattern (reference, don't perturb); enabling a real
facilitator (`X402_FACILITATOR_URL`) or any prod env / migration / publish (founder-gated). **Reject scope
creep, gold-plating, deferred-work pull-in (e.g., the B1.4 "starvation at scale"/`last_reconciled_at` item is
SEPARATE — out).** The bar: *"no x402 surface admits a network outside the canonical settleable+confirmable
set; the legit Base mainnet (prod) + Base Sepolia (non-prod) paths are byte-behavior-stable."*

---

## 4. Ground state + pre-flight (verify before touching anything)

- Repo `/Users/lex/settlegrid`, branch `main`. **HEAD = `23663006`** = `origin/main` (deployed prod, LIVE;
  (H)+(F1)+(K) shipped). (G) is a **fresh local commit atop `23663006`.** Confirm: `git -C /Users/lex/settlegrid
  log -1 --oneline && git status -sb`. Working tree clean (only this handoff untracked).
- **Baselines (re-run to anchor BEFORE any edit; end-state keeps them green + only this chunk's deltas):**
  - `cd apps/web`: `npx tsc --noEmit` (**0**) · `npx vitest run` (**4313 / 185**) · `npx next build` (**0**;
    not concurrent with tsc) · `npx eslint <changed files>` (0).
  - `cd packages/mcp`: `npx vitest run` (**1898 / 1 skip**) — **byte-stable UNLESS the trace decides the mcp
    `USDC_ADDRESSES` copy must change** (LB-1); if it changes, that's a deliberate, audited frozen-spine edit.
  - Python family (`packages/sdk-python*`): byte-stable (`git diff --numstat`).
- **Real-money guardrails:** do NOT push, set/change prod env (incl. `X402_FACILITATOR_URL`), apply migrations,
  or publish (all founder-gated). DB access **read-only**. (G) needs **no migration** (no schema change — it's
  an allowlist guard).
- **Shell is zsh:** quote bracketed paths (`'apps/web/src/app/api/proxy/[slug]/route.ts'`).

---

## 5. THE ARC — phases 1→3 MUST complete (audit PLAN_READY, 0 blocking, all fixes) before ANY build code

### Phase 1 — scope-confirm DISCOVERY TRACE (no plan without it)
Write `docs/tech-debt/g-x402-network-allowlist-trace-2026-06-09.md`. Re-derive every §0–§4 claim against live
code, each grounded in a file:line read THIS session. Nail: **(a)** the COMPLETE x402 network-surface set —
grep every consumer of `USDC_ADDRESSES` / `PUBLIC_FACILITATOR_NETWORKS` / `SUPPORTED_CHAINS` /
`X402_MAINNET_NETWORK` and every `network` field on an x402 settle/advertise path across `apps/web/src` **and
`packages/mcp`** (prove the set is complete — the mcp `USDC_ADDRESSES` copy is the easy-miss); **(b)** which
surfaces are already guarded (facilitator v1, proxy F2, reconciler) vs unguarded (`/api/x402/settle`,
`/api/x402/supported`); **(c)** the canonical-set decision + its prod/non-prod shape (vs
`isX402TestnetSettlementAllowed`/`isProduction`); **(d)** whether the mcp `USDC_ADDRESSES` copy must change or
the app filters downstream; **(e)** whether `/api/x402/settle` actually moves money on an arbitrary network
(trace `settleExactPayment` — does it itself guard? if it already rejects unknown networks, the gap is
advertisement-only and the tier may DROP — re-derive honestly); **(f)** the exact test sweep + the no-drift
invariant test; **(g)** no migration needed.
> **NB:** if the trace proves `settleExactPayment` already hard-rejects non-Base (so `/api/x402/settle` can't
> actually move money on `eip155:1`), the funds-safety trigger weakens to an advertisement-consistency fix →
> **re-classify to INCREMENTAL and say so** (under-auditing is the danger; but don't over-audit a cosmetic fix).
> The tier is provisional HIGH-STAKES pending this trace finding.

### Phase 2 — BUILD PLAN (status DRAFT until the audit passes)
Write `docs/tech-debt/g-x402-network-allowlist-build-plan-2026-06-09.md`: goal + honest framing + the TIER
(confirmed/adjusted per the Phase-1 NB); the resolved LB-1/LB-2 with proofs; EXACT per-file recipes; the
canonical-set definition + every surface routed through it (the completeness table); the prod/non-prod guard
logic (mirrors F2); the behavior-change tests that **FAIL pre-fix** (`eip155:1` settle rejected; `/supported`
omits eth) + the behavior-neutral pins (Base mainnet + Base Sepolia still settle/advertise); the no-drift
invariant test; the byte-stable spine list (§3) + SCOPE GUARD; the machine gates (tsc 0 / vitest 4313 + N_new
/ build 0 / eslint 0; mcp 1898/1 OR the deliberate +delta if the mcp copy changes; `git diff --numstat`
confined; python byte-stable); **no migration** justification.

### Phase 3 — MANDATORY DEEP, INDEPENDENT PRE-BUILD AUDIT (the hard gate; sized to the §1/Phase-1 tier)
**No implementation code until the plan is audited PLAN_READY (0 blocking) with ALL fixes applied.**
- **Mechanism:** a dynamic `Workflow` fan-out (NOT a hand-audit). Adapt the most recent prebuild harness
  (`.audit/k-prebuild/prebuild-audit.mjs`) → `.audit/g-prebuild/prebuild-audit.mjs` — **keep its hardened tail
  VERBATIM** (null-guard + degraded fallback). Shape: N fresh-context lenses re-derive the plan's claims
  against actual code → **adversarial verify** of every finding (default-refuted) → guarded synthesis at
  PLAN_READY / 0 blocking. **HIGH-STAKES → full lens set (~7) + per-finding adversarial verify.** (If Phase-1
  re-classified to INCREMENTAL, use the reduced set + no separate verify pass, per the tier.)
- **MECHANICAL-FIRST (required):** BEFORE the fan-out, settle every mechanically-checkable claim with a
  deterministic script/probe and feed the results in: run the gates (tsc/vitest/build/eslint; mcp); a
  **surface-completeness probe** (grep every `USDC_ADDRESSES`/`PUBLIC_FACILITATOR_NETWORKS`/`SUPPORTED_CHAINS`/
  x402-`network` consumer across `apps/web/src` + `packages/mcp`; assert the set == the planned guarded set —
  so no surface is missed); a **no-drift probe** (`PUBLIC_FACILITATOR_NETWORKS ⊆ canonical ⊆ SUPPORTED_CHAINS`);
  a **guard-correctness probe** (an `eip155:1` payload is rejected at `/api/x402/settle`; a Base mainnet payload
  passes; Base Sepolia passes in non-prod, fails in prod — mirroring F2). Keep mechanical checks as scripts.
- **HIGH-STAKES lens set (full) — suggested ~7:** (a) factual accuracy + the surface map (every file:line incl.
  the mcp copy); (b) funds-safety / settle-boundary (the guard rejects non-confirmable BEFORE `settleExactPayment`
  moves money; no real-money path left unguarded); (c) completeness (EVERY advertise/accept/settle surface
  routed through the canonical set; no 5th surface missed); (d) prod/non-prod correctness (mainnet-only in prod,
  +sepolia non-prod; F2 not loosened; Base Sepolia e2e not broken); (e) no-drift invariant (the three sets can't
  silently diverge again); (f) scope / zero-out-of-spine (engine/reconciler-math/F2-behavior/(H)/(C)/(K)/rate-
  limit/pricing/payouts/mcp-non-x402/sdk-python untouched; the mcp `USDC_ADDRESSES` change, if any, is the ONLY
  spine edit and is deliberate); (g) test sufficiency (behavior-change fails pre-fix; Base paths pinned; sweep
  exact; arithmetic exact). **Run every reasoning role on the most capable model.**
- **RECURRENCE LENS (new, standing):** charge the reviewers with the project's **defect-class ledger** —
  `.audit/defect-ledger/INDEX.md` (19 classes mined from 205 past audit findings). For (G) the
  highest-relevance classes are **DC-07** (multi-surface constant/gate drift — this chunk's entire raison
  d'être), **DC-05** (test-double surface divergence — check every `vi.mock` factory against newly-imported
  symbols; the K-chunk blocker pattern), **DC-13** (latent-in-prod logic — the facilitator path is latent),
  **DC-01/DC-04** (money/crypto-rail invariants), and **DC-15** (plan-drift — re-derive this handoff's claims).
  Each class file carries a mechanical *Detection cue* — turn the relevant ones into probes in the
  MECHANICAL-FIRST step.
- **COVERAGE-MODE REPORTING (high-stakes):** every lens reports EVERY finding — including uncertain and
  low-severity ones — tagged with confidence (high/med/low) and severity; NO self-filtering. The adversarial
  verify pass then refutes/sustains each. (If Phase-1 re-classifies to INCREMENTAL: reduced lens set,
  single-pass against the concrete bar — report anything that could cause incorrect behavior, a failing check,
  or a misleading result; omit only pure style; no separate verify pass.)
- **MODEL POLICY (set per-agent EXPLICITLY; never silently inherit):** decisive roles — the lens reviewers +
  the synthesizer — `model: opus` (most capable exposed), effort high. Bounded roles — the per-finding
  adversarial refuters — `model: sonnet` (one frontier tier down), effort high. Mechanical checks = scripts,
  never model calls. Effort is session-level and operator-managed; if a decisive role would run below high
  effort, pause and queue the operator switch rather than run it under-effort.
- **Run twice if it finds blockers:** R1 → apply ALL fixes to the plan → R2 PLAN_READY 0-blocking. The
  implementer re-confirms every sustained finding LIVE before folding; all fixes land before any build.
- **DEGRADED-RUN GUARD:** `deadLenses>0` / `nullVerdicts>0` / `degraded=true` is **NOT a pass.** Back off ~4 min
  + re-run; `Workflow({scriptPath, resumeFromRunId})` replays cached agents after a partial death.
- **Charge each reviewer in ISOLATION** (its lens only, never the cadence/seal/other phases). **Guard the spine**
  (reject the ADD-Ethereum-confirm alternative, F2 loosening, engine/reconciler-math changes, deferred B1.4
  starvation work). **Defer NO finding** — this phase is the last line of defense.
- **⚠️ SPINE-SAFEGUARD / OVER-AUDITING CLAUSE (embed VERBATIM in this gate AND the seal):** Objective confidence,
  NOT finding-count. **Zero findings is a valid outcome.** A finding that grows scope is
  `rejected-scope-expansion`, NOT blocking, unless it proves a PLANNED change is itself wrong. Hold the line
  against: the ADD-Ethereum-confirm path; loosening F2; touching the settle engine / reconciler math / (H) /
  (C) / (K) / rate-limit / pricing / payouts / meter-credit / non-x402 mcp / sdk-python; enabling a facilitator
  or any prod env / migration / publish; re-litigating settled designs without a NEW trace. Re-opening a settled
  decision requires a concrete new trace.
- Record `.audit/g-prebuild/round{1,2}-verdict.txt` + a `CHECKPOINT.md`.

### Phase 4 — BUILD (single-writer, with interval self-verification)
Implement strictly to the PLAN_READY plan. **Single-writer core** (fan-out is for the audit gates only).
Line-surgical; touch only the planned sites. Keep each batch green. Prove fail-pre-fix empirically for the
behavior-change tests (record to `.audit/g-build/`). **INTERVAL SELF-VERIFICATION:** after each major batch
(the canonical set landed; the settle-boundary guard landed; the advertisement+tests landed), spawn ONE
fresh-context subagent (`model: sonnet`, read-only) charged with diffing the built state against THIS handoff's
§3 in-scope list + LB-1/LB-2 — it reports drift/omissions only; the builder re-confirms any hit live before
correcting. Ground every progress claim in a tool result from the session — report only work you can point to
evidence for.

### Phase 5 — EXECUTABLE GATE → end the build session with a CADENCE-STATUS report
When tsc 0 / vitest 4313+N_new / build 0 / eslint 0 / mcp 1898/1 (or the audited +delta) / python byte-stable /
scope confined — stop and report CADENCE-STATUS, flagging readiness for the seal-gating review.

### Phase 6 — SEAL-GATING REVIEW + SEAL (0 blocking BEFORE any commit)
A funds/security-posture SEAL (the x402 settle boundary). Adapt `.audit/k-postbuild/seal.mjs` → `.audit/
g-postbuild/seal.mjs` (keep the hardened tail), lenses for: funds-safety of the SHIPPED guard (no unguarded
real-money settle on a non-confirmable network); surface completeness (re-run the completeness probe vs the
shipped diff); prod/non-prod correctness (F2 intact, Base Sepolia e2e intact); no-drift invariant; scope /
zero-out-of-spine; test integrity. Embed the §Phase-3 SPINE-SAFEGUARD clause VERBATIM. Degraded-run guard +
resume. **0 blocking before ANY commit.** Then (for HIGH-STAKES) a **post-seal deep audit (③)** of the
integrated whole (whole-repo x402-network-surface sweep; cross-chunk seams with the proxy/reconciler/facilitator).

### Phase 7 — FOUNDER-GATED CLOSE-OUT
LOCAL commit, path-scoped, atomic (never `git add -A`; quote bracketed paths; founder identity
`Luther Whiting-Collins <lexwhiting@gmail.com>`, trailer `Co-Authored-By: Claude <exact model>
<noreply@anthropic.com>`). **NO push. NO publish. NO migration. NO prod-env set.** Then: capstone
(`g-x402-network-allowlist-resolution-2026-06-09.md`); **close the B1.4 carried-debt item 2 (the non-Base
half)** in `b1.4-settlement-reconciler-2026-05-31.md` + the B1 memory banner; **the (K) docs-tidy RIDER** —
update `k-hmac-pepper-resolution-2026-06-08.md` + the register's (K) UPDATE section from "PUSH HELD / NOT
pushed" to SHIPPED+LIVE (`23663006`, deployed+smoke-tested 2026-06-09; docs-only, rides this commit);
next-chunk handoff; memory; **slot any new audit-caught defects into the defect-class ledger**
(`.audit/defect-ledger/`). **Surface to the founder at close:** (G) makes enabling a public
`X402_FACILITATOR_URL` safe w.r.t. non-Base settlement; the B1.4 "starvation at scale" half remains open
(separate, at-volume, needs a migration).

---

## 6. Frozen / existing surfaces to build ON (do not modify; read for shape)
- **Network lists:** `lib/settlement/x402/types.ts` `USDC_ADDRESSES` (+ `PERMIT2_ADDRESSES`);
  `packages/mcp/src/adapters/x402.ts` `USDC_ADDRESSES` (the **frozen-spine duplicate**);
  `api/x402/facilitator/v1/_shared.ts` `PUBLIC_FACILITATOR_NETWORKS`; `lib/settlement/circle-nano/settle-engine.ts:37`
  `SUPPORTED_CHAINS`; `lib/env.ts:201` `X402_MAINNET_NETWORK` + `:213` `isX402TestnetSettlementAllowed` + `:190`
  `isX402SettlementEnabled`.
- **x402 settle surfaces:** `'api/x402/settle/route.ts'` (UNGUARDED — the money one to guard);
  `'api/x402/facilitator/v1/settle/route.ts':78` (already PUBLIC_FACILITATOR_NETWORKS-guarded — reference
  pattern); `'api/x402/supported/route.ts':35` (advertises raw USDC_ADDRESSES); `'api/x402/facilitator/v1/
  supported/route.ts':53` (already filters — reference pattern).
- **Already-guarded settle paths (reference, don't perturb):** `'api/proxy/[slug]/route.ts':1860` (F2 pin);
  `'api/circle-nano/settle/route.ts':165` (F2 pin); `lib/settlement/x402/orchestrate.ts` (the proxy's
  write-ahead 'pending' + settle).
- **Reconciler (the confirmable ground truth):** `lib/settlement/reconcile.ts` — `reconcileOneRow`, the
  `unsupported-network` → `skipped-unsupported` branch (:156-163), `SUPPORTED_CHAINS` use in the confirm engine.
- **Settle engine:** `lib/settlement/x402/*` — `verifyExactPayment`, `settleExactPayment` (the trace must
  determine whether THIS already guards networks — LB-2 / Phase-1 NB).
- **Audit templates (gitignored, on disk):** `.audit/k-prebuild/prebuild-audit.mjs` (hardened tail — keep
  verbatim) · `.audit/k-postbuild/seal.mjs` (seal shape) · `.audit/k-deepaudit/deepaudit.mjs` (deep-audit shape).
- **Defect-class ledger (gitignored, on disk — charge recurrence lenses from it):** `.audit/defect-ledger/INDEX.md`
  + 19 `DC-NN-*.md` class files (each with a mechanical Detection cue). Bootstrapped 2026-06-09 from 205 past
  audit findings (3 strata: artifacts, git diffs, workflow transcripts); critic-passed. Keep it current: slot
  new audit findings under the matching class or add a class.
- **Authority docs (context; do not edit except the B1.4 close):** `b1.4-settlement-reconciler-2026-05-31.md`
  (the carried debt); `b1.2-x402-ledger-write-2026-05-31.md`; `x402-seal-audit-fixes-2026-06-01.md` +
  `x402-onchain-settlement-2026-05-31.md` (the F2/F3/F4 go-live).

## 7. Guardrails (non-negotiable)
- **Single-writer core**; fan-out only for the audit gates.
- **Ground every conclusion in ACTUAL tool output** (gates run, greps shown, the guard proven by a probe that
  rejects `eip155:1` and passes Base — no vibes). On a money boundary, "I think every surface is covered" is
  not acceptable — enumerate them and show it.
- **Line-surgical**; §3 byte-stable spine; smaller change wins; the ONLY behavior change is the network guard.
- Do NOT push, change prod env, apply migrations, or publish. DB read-only. **No migration** (allowlist guard).
- **Context:** never stop, summarize, or suggest a new session on account of context limits — the harness
  manages context. Quality is protected structurally instead: interval self-verification (Phase 4) +
  fresh-context audit gates. Act once you have enough information to act — no re-deriving settled facts, no
  surveying options you won't pursue.

## 8. One-paragraph orientation (read last, then start Phase 1)
SettleGrid settles real USDC over x402 via `settleExactPayment` (EIP-3009, Base-pinned in the proxy by F2). But
the x402 **network allowlists disagree:** `USDC_ADDRESSES` (in the app AND a duplicate on the frozen `packages/
mcp` spine) lists `eip155:1` (Ethereum), `/api/x402/supported` advertises it, and the standalone `/api/x402/
settle` route accepts ANY network with no guard — while the reconciler's confirm engine is **Base-only**
(`SUPPORTED_CHAINS`). So a settlement on `eip155:1` is advertised + acceptable but **never confirmable** — the
B1.4 carried debt. (G) makes every x402 advertise/accept/settle surface derive from **one canonical
settleable+confirmable allowlist** (prod: mainnet-only; non-prod: +Base Sepolia, mirroring F2) and **rejects
non-confirmable networks at the settle boundary** — closing the gap *before* a public facilitator is enabled,
without touching the settle engine, the reconciler math, or the F2 pin. The two load-bearing, silently-wrong-
prone calls are (LB-1) *covering EVERY surface — incl. the easy-miss mcp `USDC_ADDRESSES` copy — from one
source of truth* and (LB-2) *rejecting at the actual settle boundary, prod/non-prod-correct, without breaking
the legit Base mainnet + Base Sepolia paths.* Start with the trace; the Phase-1 NB may re-classify the tier if
`settleExactPayment` already hard-rejects non-Base — re-derive honestly and don't over- or under-audit.
</content>
