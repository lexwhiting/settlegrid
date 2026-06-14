# (W) — ops/hygiene DRAIN — ② SEAL-GATING REVIEW — RESOLUTION (SEALED, 2026-06-13)

> **② of the ARC.** The chunk was built (① handoff: `w-hygiene-drain-handoff-2026-06-13.md`),
> its executable gate was green, and this session ran the independent hostile seal-gating review
> that DECIDES the seal. **VERDICT: SEALED.** Tier holds **INCREMENTAL** (re-confirmed against the
> realized diff). Founder-gated: NOT committed / pushed / deployed; DB read-only.

## One-line verdict
SEALED. 7-file diff (1 prod observability file + 6 test/comment files); 3 lens-distinct fresh-context
opus reviewers (xhigh) returned **0 high / 0 medium**; the load-bearing S-D14 fix was reproduced
LIVE fail-then-pass; one LOW comment-drift in the chunk's own remit (N1) was fixed in-phase. Gate
green on the final tree. ③ deep audit NOT warranted.

## Tier re-confirmation
INCREMENTAL, not escalated. Realized diff = `apps/web/src/lib/logger.ts` (observability infra,
verified money-path-independent) + 6 test/comment files. No frozen-surface edit, no input boundary
opened, no contract/schema/invariant/published-claim touched, no migration. Matches the ① plan; not
riskier than predicted. (Spec-conformance reviewer independently re-confirmed.)

## Executable gate (final tree, post-N1-fix; `.audit/w-hygiene-seal/gate.log`)
- `tsc --noEmit` → **0**
- `eslint` (7 changed files) → **0**
- `vitest run` → **191 files / 4434 passed / 0 fail** (baseline 4432 + 2 S-D14 pins; **update the
  register's gate baseline 4432 → 4434**)
- `next build` → **0**, BUILD_ID `M37MWunsVDfFyMWapmnf2`

## The panel
Fan-out via Agent-tool spawns (operator did not opt into a Workflow this turn — flagged as a
candidate; the fan-out → verify → integrate shape is a prime workflow candidate for next time). All
reviewers + integrator on **opus (claude-opus-4-8)**, pinned at spawn; session effort **xhigh**
(operator-set in the upfront pause). No `/effort max` core-invariant pass — that is reserved for
HIGH-STAKES chunks; this is INCREMENTAL. Three lenses, coverage mode:
1. **Correctness / determinism** — emit() under hostile/edge inputs; the 6 test files' order-independence.
2. **Spec-conformance / scope-discipline** — the 7 locked items as-written; the 9 HELD items absent; frozen surfaces byte-clean.
3. **Core invariant** — observability truthfulness (DC-18) + money-path independence; a hostile-input battery driving the real logger.

## Findings (0 high · 0 medium · 9 LOW) and dispositions
| # | Lens | Finding | sev | disposition |
|---|---|---|---|---|
| N1 | correctness | `hop-rail-guard.test.ts` afterEach comment claims `vi.restoreAllMocks()` "would wipe this file's hoisted vi.fn(impl) mocks" — FALSE for vitest 2.1.9 (restore preserves vi.fn(impl); no spies exist) | low | **FIXED in-phase** (DC-15, the chunk's own remit) — comment-only; rationale corrected; re-verified green. LIVE probe in `repro-sd14-and-restore-probe.txt`. |
| N2 | correctness | `logger.test.ts` Test 2 title "precedence preserved under spread-first" — passes against the old form too, so it doesn't pin *this* diff's change | low | NO FIX — title is defensible ("preserved" = the refactor didn't regress err-precedence, which the ① handoff explicitly required the builder to confirm). Recorded. |
| F1 | spec | ① handoff prose "settlement logs pass zero `msg:` meta keys" is factually wrong (`cron/settlement-reconcile/route.ts:28` passes one) | low | Documentation error in the ① handoff; **no seal bearing** — money-path-independence holds on the config-guard fact (the `:28` site is inside the `!cronSecret` guard that returns 500 BEFORE `reconcilePendingSettlements()` at `:43`); the fix actively IMPROVES that site. Corrected here; ① handoff left as the historical artifact. |
| F2 | spec | ① handoff says "5 test files"; realized touches 6 (the authorized S-D14 logger pin file) | low | Cosmetic prose miscount; the S-D14 pin file was explicitly authorized. Recorded. |
| F3 | spec | test-count delta +2 vs handoff's "≈+1" | low | Within authorization ("a small logger test pinning S-D14"; the 2nd pin guards the err-precedence the handoff mandated confirming). Baseline updated 4432→4434. |
| F4 | spec | Item 1 micro-form: `const ts = …` hoist vs inline `ts: new Date()…` | low | Functionally identical (single eval, same key position); not a spec deviation. |
| C-F2 | core | human `meta.msg` string is now DROPPED from the stdout line (overwritten by the structured key) | low | **Accepted tradeoff** — it is the intended fix (the structured key MUST win for alert rules/log queries). The human string is mirrored in Sentry `extra`; co-passed keys (e.g. `offset`, `error`) survive. Only non-redundant loss = the `isTimeout` boolean at a handful of crawler `.error` ternary sites (non-money telemetry, recoverable from the surviving `error:` field). A 34-site `msg→detail` rename would be scope-creep — see Forward notes. |
| C-F3 | core | `meta.stack` survives when `err` is a non-Error | low | **PRE-EXISTING** (byte-identical in baseline b3b1e175); zero delta from this diff; no prod site passes a `stack:` meta. Recorded only. |
| C-F4 | core | a circular-reference `meta` makes `JSON.stringify(entry)` throw and crash the caller | low | **PRE-EXISTING**, not introduced (spread order doesn't change reachability); no money-path site passes self-referential meta. Recorded only. |

## The N1 in-phase fix (the only code change this seal landed)
`apps/web/src/lib/settlement/__tests__/hop-rail-guard.test.ts` afterEach comment. Old text asserted
`vi.restoreAllMocks()` would wipe `mockRedis`/`mockDb`. LIVE probe (vitest 2.1.9, repo config):
`incrby(impl)=100`, `select(impl)={"from":"x"}` survive restore; only bare `vi.fn()` resets. The file
has no `vi.spyOn`. Corrected comment states the accurate reason (env/global leak → `unstub*` is the
targeted cleanup; `restoreAllMocks` unnecessary). Comment-only, zero behavior; re-review of class =
proportionate-reduced (re-read + re-run gate green). This is itself a DC-15 instance — fitting, since
(W)'s remit is comment/handoff-drift drainage.

## Live reproductions (the seal's filter; `.audit/w-hygiene-seal/repro-sd14-and-restore-probe.txt`)
1. **S-D14 fail-then-pass:** the new pin FAILS against baseline `b3b1e175`'s old meta-last emit()
   (`expected 'CRON_SECRET not configured' to be 'cron.aggregate_usage.no_secret'`) and PASSES on the
   working-tree spread-first emit(). Genuine red→green regression guard.
2. **restoreAllMocks semantics** (adjudicated N1) — see above.

## Bookkeeping done on seal
- **Register** (`s-deep-audit-register-2026-06-10.md`): added a **(W) DRAIN CLOSURE** banner; marked
  **C4 CLOSED-by-(V)** (reconcile.ts:353 zero-row guard, alert post-commit — confirmed this session);
  annotated the (W)-drained P7 lines (S-D14, the two test-isolation flakes, the starvation-suite
  residuals) as CLOSED-by-(W); updated the gate baseline note to 4434.
- **Defect ledger** (`.audit/defect-ledger/`): appended (W) faces to **DC-18** (the logger
  spread-order clobber, found+closed), **DC-05** (the inert `isCircleNanoEnabled` mock-key matching a
  deleted surface + the two order/pool flake hardenings), and **DC-15** (the N1 false comment rationale
  + the F1/F2 handoff prose drift); INDEX one-liners bumped.
- **Derived snapshots**: `.audit/w-hygiene-seal/{SEAL-STATUS.md, built.diff, gate.log,
  repro-sd14-and-restore-probe.txt}`.

## Forward notes (→ ① for the next chunk; ③ NOT warranted)
After this drain the register holds ONLY founder-gated items + fold-on-open riders, each waiting for
its frozen surface to open:
- **Fold-on-open riders:** S-D16 (`eip155:1` strings in frozen `x402/verify.ts`), DC-07-ttl
  (`SETTLE_LOCK_TTL` two literals in the frozen settle orchestrators), S-D4/D11 (`verifyLedgerIntegrity`
  in frozen `ledger.ts`), the `route.ts:335/:478` comment portion (money-spine file), and S-D18
  (openapi — DC-16-charged micro-fix, touches a published contract).
- **Founder-gated:** S-D7 (out-of-band reconcile dead-man switch), S-D12 (GDPR `stripeConnectStatus`),
  S-D13 (`tools.totalInvocations`), P9 (credit-finality policy), V-N1/V-N2 (buyer-facing caps), etc.
- **Optional micro-fix surfaced by C-F2 (NOT this chunk):** at the ~handful of crawler `.error`
  ternary sites (`universal-crawlers.ts`), the human distinction (`isTimeout ? 'Timed out' : 'Fetch
  failed'`) was carried ONLY by `msg:` and is now dropped from stdout (still in the `error:` field).
  If preserving it in stdout matters, move it to a dedicated meta key (e.g. `reason:`) — a small,
  separable hygiene fix, out of (W) scope.
- **Next buildable chunk — CORRECTION (2026-06-13, post-seal source-of-truth re-check):** the ①
  handoff's stated "next money chunk (B4 settlement-row attribution / B1.4-item-2 starvation)" is
  **STALE — both are already CLOSED**: B4 is RESOLVED-BY-DESIGN (founder Step-0 2026-06-04,
  `account_id = developerId` permanent semantic, guard-tested — NEVER backfill); B1.4-item-2
  starvation was CLOSED by (S) (`s-reconciler-starvation-resolution-2026-06-10.md` closes the B1.4
  register entirely). The autonomously-buildable deep-audit backlog is essentially DRAINED. What
  remains in the register: (i) FOUNDER-decision items — V-N1/V-N2 (HIGH), V-N3 (MED), P9,
  S-D7/D12/D13; (ii) fold-on-open riders that need a frozen surface to open first (S-D16, DC-07-ttl,
  S-D4/D11, route.ts:335/:478, S-D18); (iii) ONE buildable-without-a-founder-decision chunk: **V-N4**
  (MED — reconciler nonce-read block-pinning; HIGH-STAKES: touches the frozen settle-engine + an
  archive-node/pruning design tradeoff). The next chunk is therefore a founder fork (decide V-N1/V-N2
  vs build V-N4 vs pivot), surfaced to the operator rather than auto-selected.

━━ CADENCE STATUS ━━
Done:  ② seal-gating review → **SEALED**
Tier:  incremental  (escalated? **n**)
Policy: **applied** — opus (claude-opus-4-8) all roles, pinned at spawn; session effort xhigh (operator-set upfront); no /effort max pass (incremental).
Workflow: **proceeded via Agent-tool spawns** (operator did not opt in; ▸ prime candidate for next time).
▶ NEXT: ③ NOT warranted (incremental). The ① handoff's "B4 / B1.4-item-2" next-pointer is STALE (both CLOSED — see the corrected Forward-notes bullet). Deep-audit autonomous backlog essentially drained → next chunk is a founder fork (V-N1/V-N2 decision · build V-N4 · pivot), surfaced to the operator.
