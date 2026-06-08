# (H) hop-route ledger rail-enum guard + (F1) sessionLimiter NAT-fairness split — POST-SEAL HANDOFF (2026-06-08)

> **Status: BUILT + SEALED, NOT committed.** Base = `839455fb` (deployed prod). The sealed change is the
> uncommitted working tree atop it. Remaining actions are **founder-gated**. Read this end-to-end.

## 1. Gate arc (all passed — full coverage on both audit gates)
| Phase | Result |
|---|---|
| Scope-confirm trace | `docs/tech-debt/h-f1-trace-2026-06-08.md` |
| Build plan | `docs/tech-debt/h-f1-build-plan-2026-06-08.md` (PLAN_READY) |
| **Pre-build audit** | **PLAN_READY** · 0 blocking · 0 dead/0 null · `wf_770141d2-15b` · `.audit/h-prebuild/round1-verdict.txt` |
| **Build + executable gate** | tsc 0 · vitest **4301/184** · next build 0 · eslint 0 · mcp **1898/1** · `.audit/h-build/BUILD-RESULT.txt` |
| **Seal-gating review** | **CERTIFIED** · 0 blocking · 0 dead/0 null · `wf_a4afe8ce-ca6` · `.audit/h-postbuild/SEAL-VERDICT.txt` |
| Certificate + snapshot | `.audit/h-certify/CERTIFICATE.txt` + `SNAPSHOT.sha256` (13 files + the 343-line `shipped.diff`) |

TIER: **HIGH-STAKES** (money/reconciler invariant + rate-limit security boundary + the moat), re-confirmed
against the realized diff (not riskier than planned).

## 2. What shipped (the two intended behavior changes ONLY — funds-neutral + bounded)
- **(H)** `recordHop` (`sessions.ts:470`) now **skips** the unified-ledger settlement write (+ logs
  `session.hop_settlement_skipped_onchain_rail`) when `rail ∈ RECONCILABLE_RAILS {circle-nano,x402}`; the
  hop is still recorded for budget (the synchronous JSONB+spentCents write, unchanged, above the guard).
  New `rails.ts` is the single source of `RECONCILABLE_RAILS`, imported by **both** `reconcile.ts` (the
  reconciler `inArray`) and `sessions.ts` (the guard) ⟹ the guard's exclusion set ≡ the reconciler's
  selection set, **by construction**. Closes the reconciler-starvation hazard (mis-credit was already
  impossible). Durability unchanged (lib fire-and-forget). **No migration. Trail NOT activated.**
- **(F1)** new `sessionLimiter = lazyLimiter(5000,'1 m')` on the **4 non-inserting** in-session routes
  (`hop`/`get`/`finalize`/`complete`); the **row-inserting** `create`/`delegate` stay byte-stable on
  `sdkLimiter` 1000; every money path stays 1000.

Change set (13 code/test files; spine byte-stable — `recordSettlementEntry` + its 3 on-chain callers, the
reconciler confirm/credit logic, `create`/`delegate`, pricing/payouts/crypto/mcp/sdk-python all UNCHANGED).

## 3. ③ Post-seal deep audit (NEXT — high-stakes)
The seal (②) scoped strictly to the **built code/diff**. ③ is the deeper/independent pass (e.g. the
integrated-system view, rollout/deploy posture, residuals-at-scale). It inherits a **clean, sealed** base:
- Verify the working tree still matches `.audit/h-certify/SNAPSHOT.sha256` (no drift since seal).
- All artifacts above are available; the gate is green and reproducible (`.audit/h-postbuild/gate-*.log`,
  `preflight/RESULTS.txt`, `shipped.diff`).

## 4. Founder-gated close-out (after ③, on the founder's word — NOT done here)
**Guardrails (non-negotiable):** NO push · NO prod-env change · NO migration apply (none exists) · NO publish.

**(a) LOCAL commit** — path-scoped, atomic, **never `git add -A`**; quote bracketed paths; author as the
founder; the working tree must still match the SNAPSHOT hashes. Add exactly:
```
apps/web/src/lib/settlement/rails.ts
apps/web/src/lib/rate-limit.ts
apps/web/src/lib/settlement/reconcile.ts
apps/web/src/lib/settlement/sessions.ts
'apps/web/src/app/api/sessions/[id]/route.ts'
'apps/web/src/app/api/sessions/[id]/hop/route.ts'
'apps/web/src/app/api/sessions/[id]/finalize/route.ts'
'apps/web/src/app/api/sessions/[id]/complete/route.ts'
apps/web/src/lib/settlement/__tests__/hop-rail-guard.test.ts
'apps/web/src/app/api/sessions/[id]/hop/__tests__/route.test.ts'
apps/web/src/lib/settlement/__tests__/reconcile.test.ts
apps/web/src/lib/__tests__/rate-limit.test.ts
apps/web/src/app/api/__tests__/sessions.test.ts
docs/tech-debt/h-*.md
```
Identity `Luther Whiting-Collins <lexwhiting@gmail.com>`; trailer `Co-Authored-By: Claude Opus 4.8
<noreply@anthropic.com>`. Suggested subject: `feat(web): (H) hop-route ledger rail-enum guard + (F1)
sessionLimiter NAT-fairness split`.

**(b) Capstone** (`h-f1-resolution-2026-06-08.md`), **(c) register UPDATE** — close **F1**; record the
**(H)** disposition (safety-only guard shipped; **no migration**); **(d) next-chunk handoff**; **(e) memory**
(`settlegrid-debt-chunks.md` + `MEMORY.md`).

## 5. Founder flags / residuals (honest)
- **(H) is safety-only.** Activating the hop ledger **trail** (an auth'd internal caller supplying a trusted
  `accountId` + wiring it through the hop-route zod schema) is a **separate, larger, separately-audited
  chunk** — the public hop route accepting a caller-supplied `accountId` would be a money-attribution
  vulnerability, which is why it's OUT here.
- **(F1) N=5000** is audit-confirmed non-blocking (financial abuse impossible at any N; the 4 raised routes
  are budget-capped + non-row-inserting). Founder may tune. `create`/`delegate` deliberately kept at 1000
  (they insert `workflow_sessions` rows, which have no purge cron).
- **Subsystem 2** (batch settlement / `processSettlementBatch` / deferred `createSession`) remains UNWIRED
  and OUT.
