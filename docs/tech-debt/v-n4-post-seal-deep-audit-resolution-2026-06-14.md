# (V-N4) — reconciler expiry-pass nonce-read block-pinning — ③ POST-SEAL DEEP AUDIT — RESOLUTION (RE-CERTIFIED, 2026-06-14)

> **③ of the ARC.** The chunk was built (①), gate-green, then SEALED by the ② seal-gating review
> (`v-n4-nonce-read-block-pinning-seal-2026-06-13.md`). This session ran the independent post-seal deep audit on
> the INTEGRATED WHOLE (distinct from ②'s diff scope). **VERDICT: RE-CERTIFIED.** Prod code is BYTE-IDENTICAL to
> the seal (no behavioral change); the V-N4 TEST surface was hardened by two non-vacuity-proven assertions, and the
> headline DC-18 detector residual was ESCALATED (broader than the seal believed) and routed to a dedicated
> observability chunk. Tier holds **HIGH-STAKES**. Founder-gated: NOT committed / pushed / deployed; DB read-only.
> HEAD is still `b3b1e175`; the re-certified bytes live UNCOMMITTED in the working tree, fingerprinted below.

## One-line verdict
RE-CERTIFIED. The seal's money-safety verdict is INDEPENDENTLY RE-CONFIRMED at the highest confidence
(invariant chain re-derived from canonical sources; both money-path candidates refuted with sound guards; no
wrong-terminalize within the threat model; the two changed-signature readers have NO caller anywhere in the repo
outside `runExpiryPass`; a fresh 17-case hostile battery green). Prod readers + `runExpiryPass` UNCHANGED. Two
test-fidelity hardenings landed on V-N4's own (non-frozen) test surface, each proven non-vacuous LIVE. The DC-18
pager-masking residual is materially STRENGTHENED vs the seal and routed forward (deferred observability redesign,
NOT a hotfix). Gate green on the re-certified tree.

## Orchestration / policy
- **Workflow (ultracode opt-in):** the 5-lens fan-out + per-lens adversarial refutation ran as ONE deterministic
  Workflow (`wf_bb0c329e-70a`, 10 agents, ~922k tok). All agents pinned **claude-opus-4-8**, read-only, coverage mode.
- **Effort:** session **xhigh** for the fan-out; **/effort max** for the collective-miss critic (run in-session,
  per-agent effort not settable in a workflow) and this fix-fold + verdict. Policy applied; no reviewer refused.
- **Pre-flight (scripted, handed to reviewers):** full gate (tsc/eslint/vitest 4440/build) green; money-safety
  invariant re-derived; DC-07 + bigint-leak + held-reads static probes clean; 17-case ephemeral hostile battery
  green (deleted; fingerprints re-verified). Evidence: `.audit/v-n4-postseal/preflight-evidence.md`.

## Re-certified bytes — fingerprint (`shasum`; full gate green on this tree)
```
3216deac01e887f03cdd5583e50c086c9899939d  apps/web/src/lib/settlement/circle-nano/settle-engine.ts          (UNCHANGED vs seal)
5356b2a945b42cf900dd70e774449e1a1ab95195  apps/web/src/lib/settlement/reconcile.ts                          (UNCHANGED vs seal)
da95d57d0a59279a4f3944f23c747b55a5aa5f1a  apps/web/src/lib/settlement/circle-nano/__tests__/settle-engine.test.ts (UNCHANGED)
59341749da17cd0956241fde1ea8c79fa6f69053  apps/web/src/lib/settlement/__tests__/reconcile.test.ts           (③ HARDENED — was c27ffbbe)
4c2ba1f0ecd3676ec4cbf3329748dddddcbf2784  docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md    (UNCHANGED vs seal)
```
Baseline = HEAD `b3b1e175` + the disjoint (W) hygiene tree. Gate: tsc 0 | eslint 0 | vitest **4440/191/0** (count
unchanged — assertions added to existing tests, no new `it()`) | next build success. ⚠ Shared-tree hazard LIVE
(~15 concurrent sessions): founder should commit from a state whose shasums match the above.

## What ③ did that ②'s diff scope structurally could not
- **Integrated whole:** read `reconcile.ts` IN FULL (run loop, detectors-first block, window pass, summary identity,
  the discarded-stats call site `:899`), `ledger.ts` (the CAS writer), the cron route, `logger.ts` (the (W) emit).
- **Cross-chunk seams:** the new pager vs the (W) `logger.emit` spread-fix (no `msg` clobber — `{...stats}` keys are
  examined/terminalized/quarantined/unknown); the held un-pinned LIVE reads (correctly still 'latest'); the (U)/(V)/(S)
  invariants preserved; the evidence shape `{chainTs:number, checkedAt}` (scalar) intact.
- **Whole defect-class ledger** swept (DC-01..DC-20).
- **Reader-caller census (whole repo):** `readAuthorizationStateBounded` / `readSafeBlockTimestampBounded` have NO
  source caller outside `runExpiryPass` — airtight beyond `apps/web`'s tsc scope.
- **Independent invariant re-derivation** (from canonical `circlefin/stablecoin-evm` EIP3009.sol + viem):
  `require(now < validBefore)` STRICT; `_cancelAuthorization` moves NO tokens; reconciler reads at N only when
  `chainTs.ts > vb` (strict) ⇒ no transfer can be mined ≥ N ⇒ read-at-N captures every value-moving consume. Holds
  whether the contract gate were `<` or `<=` (the reconciler side is strict `>`). Re-attacked under reorg / TOCTOU /
  per-candidate cache-reuse / boundary / cancel-race — holds within threat model.

## Findings (post-verify; 0 high) and dispositions
| ID | Lens | Finding | sev (post-verify) | disposition |
|---|---|---|---|---|
| **DC-18 masking cluster** (L1-F1, L2-SEAM-1, L3-F1/F2/F3/F4, L5-DC18) | multi | Same-run pager `terminalized===0 && quarantined===0 && unknown>0` is co-occurrence-suppressible. ③ OVERTURNS the seal's "single-network uniform" premise: masked by (a) multi-network co-occurrence (mainnet+testnet in one pass — ROUTINE in staging), (b) per-call transient RPC errors within one network (independent eth_calls → terminalize+unknown mix), (c) chain-independent quarantines. | low–med | **ESCALATE + ROUTE, no hotfix.** Money-SAFE in every case (rows stay pending; ≤6h latency via `pending_overdue`; a TOTAL outage DOES still page same-run). Proper fix = decoupled pin-unknown tracking + per-network payload + sustained-rate paging = deferred observability redesign (register:166 "its own chunk"); a naive "page on any unknown>0" reintroduces the alert-fatigue (V) cured. Ledger **DC-18** face escalated with the corrected breadth + the recommendation. |
| **TF-1** (L4) | L4 | write-ahead-absence: swallowed onBroadcast → external_ref NULL → false loss page | **REFUTED** | applyOutcome's SECOND persistence recovers external_ref for every receipt outcome; only a process-kill survives (the pre-existing P8(b)/DC-20 window, NOT V-N4). |
| **VN4-DC06** (L5) | L5 | terminalize→'failed' then re-sign uncreditable | **REFUTED** | step-1 idempotency guard (PREVIOUSLY_FAILED 402) + step-3.5 refreshPendingValidBefore abort + the 2-conjunct evidence CAS. |
| **TF-7** (L4 / seal VN4-TF-2) | L4 | the NULL-safe-head-anchor route increments `stats.unknown` and fires the pager, but was not asserted BY NAME (R-V31 covers only the nonce-'unknown' route) | low | **FIXED (RE-CERTIFY).** Added the by-name pager assertion to R-V24's null-anchor case; proven non-vacuous live (RED when the pager is neutered). DC-18 coverage. |
| **TF-2** (L4) | L4 | R-V13's scalar-evidence guard used `objectContaining` (SUPERSET) — would PASS even if `{ts,blockNumber}` were embedded, contradicting its own comment | low | **FIXED (RE-CERTIFY).** Tightened to an EXACT-keys assertion (`Object.keys===['chainTs','checkedAt']` + no `blockNumber`); proven non-vacuous live (RED when the evidence embeds blockNumber). DC-05 (the charged class). |
| **F-DC15** (L3-F7, L5-DC15) | L3/L5 | env.ts:280 "Recommended, not required" contradicts the a2 hard precondition | low | **CARRY.** env.ts is FROZEN (§7); a2 carries the authoritative version. Fold when env.ts next opens. |
| **TF-3** (L4) | L4 | duplicate requirement-ID `R-V30` (reconcile.test.ts:937 V-N4 threading vs :1176 ② S4 credit-stat) | low | **CARRY (documented).** Renaming would ripple into the sealed ② doc's "R-V30" references → a new DC-15 drift; the cosmetic collision is recorded instead. |
| **TF-4/5/6** (L4) | L4 | default-mock unguarded (future-only) · genesis 0n coverage · upper-skew boundary value | low/info | **CARRY.** Behavior-correct; future-regression-only / gold-plating; spec §9.4 consciously accepted the default-mock ride. |
| **L1-F2** | L1 | pager can false-fire on a mid-loop DB-write throw co-occurring with unknown>0 | low | **CARRY (record).** Rare (requires a DB write to throw mid-pass); telemetry-accuracy only, money-safe. Adjacent to the DC-18 routed work. |
| **L1-F3 / L1-F4 / L2-SEAM-2 / L5-DC13** | L1/L2/L5 | budget-overrun under 429 slow-loris (pre-existing); examined>Σbuckets on silent-skips; ExpiryPassStats discarded; block.number==null unreachable for 'safe' | info | **NOTE.** By-design / pre-existing / intentional defensive totality. |
| **DC-03** (L5-VI) | L5 | cron reconcile route auths CRON_SECRET with a plain string compare (not timingSafeEqual) | info | **OUT OF V-N4 SCOPE.** Pre-existing, non-V-N4 file. Recorded for a future chunk. |

## Non-vacuity — LIVE proof of the two landed test hardenings
Mutated the SEALED `reconcile.ts` (backup + restore byte-identical, shasum re-verified `5356b2a9`): neutered the
pager (`unknown > 0` → `> 999`) AND embedded `blockNumber` in the evidence write. Result: **R-V13 (TF-2), R-V24
(TF-7), and R-V31 went RED** — each new assertion catches exactly the regression it guards. Restored; 60/60 green;
full gate green.

## DEFER-FORWARD: the DC-18 observability chunk (the one substantive ③ output)
Recommendation for the dedicated chunk (do NOT land under this seal):
1. Track pin-degraded nonce-'unknown' SEPARATELY from anchor-null 'unknown' (two counters), and page on the
   pin-counter decoupled from terminalized/quarantined.
2. Make the pager predicate PER-NETWORK (it is currently pass-global) and put the network in the payload (the
   `{...stats}` payload has no network field today).
3. Gate the page on a SUSTAINED-rate signal (N consecutive passes, or unknown-rate threshold) to keep the
   alert-fatigue cure (V) shipped — a naive per-pass page on any unknown regresses it.
4. Consider surfacing ExpiryPassStats in the ReconcileSummary (the return is discarded at `reconcile.ts:899`).
Money-safety is unaffected by all of the above (the masking is observability latency, ≤6h, never a wrong flip).

## Bookkeeping done on ③
- This resolution doc + `.audit/v-n4-postseal/{preflight-evidence.md, findings-register.md, critic-brief-and-priors.md,
  fingerprint.txt, gate-summary.txt, wf-deep-audit.mjs}`.
- Seal record (`v-n4-nonce-read-block-pinning-seal-2026-06-13.md`): ③ footer appended (RE-CERTIFIED + new fingerprint).
- Register (`s-deep-audit-register-2026-06-10.md`): V-N4 marked ③ RE-CERTIFIED; gate baseline stays 4440.
- Defect ledger: **DC-18** masking face escalated (broader breadth + the routed recommendation); **DC-05** TF-2 face
  appended (superset-match test-honesty fix landed); INDEX one-liners bumped.

━━ CADENCE STATUS ━━
Done:  ③ post-seal deep audit → **RE-CERTIFIED**
Policy: **applied** — opus (claude-opus-4-8) all roles pinned at spawn; effort xhigh (fan-out) → max (critic + fix-fold).
Workflow: **ran as workflow** (`wf_bb0c329e-70a`, ultracode opt-in).
▶ NEXT: founder-close (path-scoped LOCAL commit of the re-certified bytes, never push) → then paste ① for the next chunk (the DC-18 observability follow-up is the natural candidate).
