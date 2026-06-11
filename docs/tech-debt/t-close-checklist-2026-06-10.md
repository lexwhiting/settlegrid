# (T) CLOSE CHECKLIST — founder-gated steps (post-③; 2026-06-10)

> ③ deep-audit fix F4: this list is AUTHORITATIVE for the commit — the build
> plan's Gates §6 file list is STALE (written before the ② seal fixes opened
> `x402/orchestrate.ts` + `circle-nano/settle.ts` and their test files under a
> recorded license, and before the ③ fixes). Committing from the plan's list
> would SHIP WITHOUT the ② funds-critical alerts. Use `git status` as the final
> cross-check — every entry below must be present, nothing else (besides
> session-incidental files you recognize).

## 1. The path-scoped LOCAL commit (founder identity; Claude trailer; NO push)
All 27 paths (19 modified + 8 new, including this checklist):
```
git add \
  apps/web/scripts/bootstrap__drizzle_migrations.sql \
  apps/web/src/app/api/circle-nano/__tests__/route.test.ts \
  apps/web/src/app/api/circle-nano/settle/route.ts \
  apps/web/src/app/api/cron/settlement-reconcile/__tests__/route.test.ts \
  apps/web/src/app/api/cron/settlement-reconcile/route.ts \
  "apps/web/src/app/api/proxy/[slug]/__tests__/billing-credits.test.ts" \
  "apps/web/src/app/api/proxy/[slug]/__tests__/circle-nano-proxy-settlement.test.ts" \
  "apps/web/src/app/api/proxy/[slug]/__tests__/x402-proxy-settlement.test.ts" \
  "apps/web/src/app/api/proxy/[slug]/route.ts" \
  apps/web/src/lib/db/schema.ts \
  apps/web/src/lib/settlement/__tests__/reconcile-starvation.test.ts \
  apps/web/src/lib/settlement/__tests__/reconcile.test.ts \
  apps/web/src/lib/settlement/__tests__/credit-writer-census.test.ts \
  apps/web/src/lib/settlement/__tests__/terminal-transition.test.ts \
  apps/web/src/lib/settlement/circle-nano/__tests__/settle.test.ts \
  apps/web/src/lib/settlement/circle-nano/settle.ts \
  apps/web/src/lib/settlement/ledger.ts \
  apps/web/src/lib/settlement/reconcile.ts \
  apps/web/src/lib/settlement/x402/__tests__/orchestrate.test.ts \
  apps/web/src/lib/settlement/x402/orchestrate.ts \
  apps/web/drizzle/0016_credited_at.sql \
  docs/tech-debt/s-deep-audit-register-2026-06-10.md \
  docs/tech-debt/t-close-checklist-2026-06-10.md \
  docs/tech-debt/t-credited-at-runbook-2026-06-10.md \
  docs/tech-debt/t-terminal-transition-build-plan-2026-06-10.md \
  docs/tech-debt/t-terminal-transition-integrity-handoff-2026-06-10.md \
  docs/tech-debt/t-terminal-transition-trace-2026-06-10.md
```
Suggested message: `feat(web): (T) terminal-transition integrity + credit
observability — CAS, credited_at marker (0016), uncredited sweep, F2 pin,
P2-mirror detection (closes register P1+P2+P3)` + the Claude trailer.

⚠ Per the shared-worktree memory: path-scoped commit ONLY (`git commit -- <paths>`
posture); do NOT `git add -A`.

## 2. Deploy sequence (real money — order is load-bearing)
1. Apply 0016 per runbook §1 (paste + hash row + the §1 step-3 schema-reality
   checks). Low-traffic moment preferred (brief write-lock).
2. Deploy the (T) bundle (push is founder-gated; remember pushes trigger Vercel
   builds).
3. First post-deploy reconcile runs: triage any `uncredited_settled` gap-window
   pages per runbook §2 (bulk-closure ONLY with the verified deploy timestamp).

## 3. Sentry alert rules (one-time — the ③ ops lens showed default rules
notify on NEW issues only; recurring identical events collapse into one issue)
Create "alert on EVERY event" (or regression) rules for:
- `reconcile.uncredited_settled`
- `settlement.settled_evidence_on_terminal_failed_row`
- `settlement.broadcast_evidence_on_terminal_failed_row`
Until then, treat the FIRST Sentry occurrence of each as standing until the
runbook closes it — re-pages will not re-notify.

## 4. Founder decisions parked here
- 0010 journal quirk (pre-existing, NOT (T)): `drizzle/` has TWO 0010_* files
  but the bootstrap registers only `0010_payouts_index_includes_unknown` (17
  rows total). Confirm `0010_ledger_operation_id_idx` was actually applied to
  prod (the `ledger_entries_operation_id_idx` index exists?) — if yes, consider
  registering its hash row next time the bootstrap opens; if no, apply it.
- Register P8 (P2-mirror prevention) pairs naturally with P5 — schedule as one
  chunk; P4 (reconciler transport timeout) was ESCALATED by ③ (the (T) sweep is
  the first casualty of a budget-overrun kill).
