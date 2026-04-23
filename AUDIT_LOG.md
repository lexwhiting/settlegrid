# SettleGrid Audit Log

Append-only log of phase gate verdicts. Each gate run appends one section.

## Phase 2 Gate — 2026-04-16T22:55:31.663Z

**Verdict:** 4 PASS / 16 DEFER / 0 FAIL (of 20)
**Mode:** default
**Exit code:** 0

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files all present |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | DEFER | skipped via --skip-build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace tests green (turbo) | PASS | 5/5 workspace tasks PASS |
| 9 | K1 — marketplace proxy uses unified adapter package | DEFER | pre-K1 state: 1 lib/*-proxy import(s), 0 kernel imports |
| 10 | K2 — 12 lib/*-proxy.ts migrated to adapter classes | DEFER | 12 *-proxy.ts files still in lib/ (K2 not yet shipped) |
| 11 | K3 — proxy-vs-kernel snapshot test exists | DEFER | /Users/lex/settlegrid/packages/mcp/src/__tests__/snapshot-equivalence.test.ts not present |
| 12 | K4 — typed MeterContext + lifecycle stubs | DEFER | /Users/lex/settlegrid/packages/mcp/src/lifecycle.ts not present |
| 13 | FMT1 — @settlegrid/ai-sdk package | DEFER | /Users/lex/settlegrid/packages/ai-sdk/package.json not present |
| 14 | FMT2 — @settlegrid/mastra package | DEFER | /Users/lex/settlegrid/packages/mastra/package.json not present |
| 15 | FMT3 — TS adapter packages polished/rebranded | DEFER | no @settlegrid/{langchain,n8n,cursor} packages present |
| 16 | FMT4 — n8n Invoke operation node | DEFER | /Users/lex/settlegrid/packages/n8n/src/nodes/Invoke.ts not present |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter interface | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T21:03:50.447Z

**Verdict:** 11 PASS / 8 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | DEFER | /Users/lex/settlegrid/packages/n8n/src/nodes/Invoke.ts not present |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T21:08:52.607Z

**Verdict:** 11 PASS / 8 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | DEFER | /Users/lex/settlegrid/packages/n8n/src/nodes/Invoke.ts not present |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T21:41:09.813Z

**Verdict:** 12 PASS / 7 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T21:46:04.091Z

**Verdict:** 12 PASS / 7 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T21:54:01.240Z

**Verdict:** 12 PASS / 7 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T22:06:04.024Z

**Verdict:** 12 PASS / 7 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | DEFER | /Users/lex/settlegrid/apps/web/src/app/compare/nevermined/page.tsx not present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T22:12:49.893Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T22:19:00.995Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T23:14:07.769Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T23:23:37.841Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-17T23:25:06.629Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:18:10.332Z

**Verdict:** 13 PASS / 6 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | DEFER | /Users/lex/settlegrid/packages/rails/src/index.ts not present |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:28:44.582Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:35:59.897Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | FAIL | tsc packages/mcp exit 2: packages/mcp/src/rails/__tests__/stripe-connect.test.ts(101,12): error TS2693: 'StripeRailAdapter' only refers to a type, but is being used as a value here. |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:36:37.627Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | FAIL | tsc packages/mcp exit 2: packages/mcp/src/rails/__tests__/stripe-connect.test.ts(101,12): error TS2693: 'StripeRailAdapter' only refers to a type, but is being used as a value here. |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:38:47.400Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:50:34.254Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | FAIL | turbo test exit 1: • turbo 2.8.17 @settlegrid/web:test: ERROR: command finished with error: command (/Users/lex/settlegrid/apps/web) /usr/local/bin/npm run test exited (1) @settlegrid/web#test: command (/Users/lex/settlegrid/apps/web) /usr/local/bin/npm run test exited (1)  ERROR  run failed: command  exited (1) |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T02:53:04.468Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:05:19.168Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:13:11.238Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | FAIL | tsc apps/web exit 2: apps/web/src/lib/__tests__/rails.test.ts(161,10): error TS2537: Type 'Partial<Record<RailId, RailAdapter>>' has no matching index signature for type 'string'. |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:14:55.930Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 0 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:45:03.200Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | FAIL | 1 lib/stripe-*.ts file(s) still import 'stripe' directly: stripe-tax.ts |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:46:00.439Z

**Verdict:** 13 PASS / 5 DEFER / 2 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | FAIL | 1 lib/stripe-*.ts file(s) still import 'stripe' directly: stripe-tax.ts |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:47:24.917Z

**Verdict:** 14 PASS / 5 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | DEFER | no COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T03:55:07.269Z

**Verdict:** 15 PASS / 4 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T17:58:27.063Z

**Verdict:** 15 PASS / 4 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T18:07:26.208Z

**Verdict:** 15 PASS / 4 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T18:16:01.664Z

**Verdict:** 15 PASS / 4 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | DEFER | neither tracker nor Wise SOP present |

## Phase 2 Gate — 2026-04-18T18:24:52.992Z

**Verdict:** 16 PASS / 3 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |

## Phase 2 Gate — 2026-04-18T18:36:40.156Z

**Verdict:** 16 PASS / 3 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |

## Phase 2 Gate — 2026-04-18T18:44:22.279Z

**Verdict:** 16 PASS / 3 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |

## Phase 2 Gate — 2026-04-18T18:51:03.824Z

**Verdict:** 16 PASS / 3 DEFER / 1 FAIL (of 20)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |

## Phase 2 Gate — 2026-04-18T18:57:24.138Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 25 tests (≥8 required); marketplace query + badge wired |

## Phase 2 Gate — 2026-04-18T18:58:57.654Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 25 tests (≥8 required); marketplace query + badge wired |

## Phase 2 Gate — 2026-04-18T19:11:06.343Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | build exit 1: e/config/eslint#disabling-rules npm error Lifecycle script `build` failed with error: npm error code 1 npm error path /Users/lex/settlegrid/apps/web npm error workspace @settlegrid/web@0.1.0 npm error location /Users/lex/settlegrid/apps/web npm error command failed npm error command sh -c next build |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 25 tests (≥8 required); marketplace query + badge wired |

## Phase 2 Gate — 2026-04-18T19:23:08.717Z

**Verdict:** 15 PASS / 6 DEFER / 0 FAIL (of 21)
**Mode:** default
**Exit code:** 0

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | DEFER | --version OK (0.1.0); smoke skipped via --skip-tests |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | DEFER | skipped via --skip-build |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | DEFER | skipped via --skip-tests |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 30 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 2 Gate — 2026-04-18T19:42:52.026Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | gallery index missing at /Users/lex/settlegrid/apps/web/.next/server/app/templates/page.html |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 30 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 2 Gate — 2026-04-18T19:45:50.703Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | only 1 shadow pages (expected ≥1000) |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 30 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 2 Gate — 2026-04-18T20:17:39.594Z

**Verdict:** 14 PASS / 6 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | DEFER | --version OK (0.1.0); smoke skipped via --skip-tests |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | DEFER | skipped via --skip-build |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | DEFER | skipped via --skip-tests |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | FAIL | claim route does not set listedInMarketplace=true (spec DoD item 3) |

## Phase 2 Gate — 2026-04-18T20:18:04.528Z

**Verdict:** 15 PASS / 6 DEFER / 0 FAIL (of 21)
**Mode:** default
**Exit code:** 0

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | DEFER | --version OK (0.1.0); smoke skipped via --skip-tests |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | DEFER | skipped via --skip-build |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | DEFER | skipped via --skip-tests |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 40 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 2 Gate — 2026-04-18T20:40:31.148Z

**Verdict:** 16 PASS / 3 DEFER / 2 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | only 1 shadow pages (expected ≥1000) |
| 6 | template-quality workflow green on main | DEFER | gh run list exit 1: HTTP 404: workflow template-quality.yml not found on the default branch (https://api.github.com/repos/lexwhiting/settlegrid/actions/workflows/template-quality.yml) |
| 7 | Meilisearch /health reports available | DEFER | NEXT_PUBLIC_MEILI_URL / MEILI_URL not set |
| 8 | Workspace typecheck + tests green | FAIL | turbo test exit 1:  @settlegrid/ai-sdk:test: ERROR: command finished with error: command (/Users/lex/settlegrid/packages/ai-sdk) /usr/local/bin/npm run test exited (1) @settlegrid/ai-sdk#test: command (/Users/lex/settlegrid/packages/ai-sdk) /usr/local/bin/npm run test exited (1)  ERROR  run failed: command  exited (1) |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 40 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 2 Gate — 2026-04-18T20:47:03.680Z

**Verdict:** 17 PASS / 3 DEFER / 1 FAIL (of 21)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | CLI installable + smoke passes | PASS | --version 0.1.0, smoke PASS |
| 2 | Registry exists, validates, ≥20 templates | PASS | 20 templates, all valid |
| 3 | Canonical 20 templates polished (4 files each) | PASS | 20 templates × 4 files present, all template.json valid |
| 4 | Shadow directory populated (≥1000 rows) | DEFER | DATABASE_URL not set in env |
| 5 | SSG build emits gallery + ≥1000 shadow pages | FAIL | only 1 shadow pages (expected ≥1000) |
| 6 | template-quality workflow green on main | DEFER | skipped via --skip-network |
| 7 | Meilisearch /health reports available | DEFER | skipped via --skip-network |
| 8 | Workspace typecheck + tests green | PASS | tsc clean (mcp+web), 10/10 turbo tasks |
| 9 | K1 — marketplace proxy uses unified adapter package | PASS | 2 file(s) reference unified-adapter dispatch (protocolRegistry / decideUnifiedDispatch) |
| 10 | K2 — 13 lib/*-proxy.ts migrated to adapter classes | PASS | 13 file(s) are thin shims importing @settlegrid/mcp |
| 11 | K3 — proxy-vs-kernel snapshot test exists + included in test runner | PASS | proxy-equivalence.test.ts present with 86 test declarations |
| 12 | K4 — typed MeterContext + lifecycle stubs | PASS | MeterContext + 4 lifecycle stubs present |
| 13 | FMT1 — @settlegrid/ai-sdk package builds + ≥6 tests | PASS | build + 64 tests pass |
| 14 | FMT2 — @settlegrid/mastra package builds + ≥6 tests | PASS | build + 88 tests pass |
| 15 | FMT3 — TS adapter packages polished/rebranded (@settlegrid namespace + READMEs) | PASS | 3/3 present, all @settlegrid + README |
| 16 | FMT4 — n8n Invoke operation node | PASS | invokeTool operation present in SettleGrid.node.ts (n8n smoke test deferred — needs local n8n runtime) |
| 17 | MKT1 — /compare/nevermined draft page | PASS | comparison page present |
| 18 | RAIL1 — Stripe behind RailAdapter (no direct stripe imports in lib/stripe-*) | PASS | RailAdapter + StripeRailAdapter exported; 1 lib/stripe-*.ts file(s) routed through adapter |
| 19 | COMP1 — OFAC + AUP + IR playbook docs | PASS | all 3 COMP1 docs present |
| 20 | INTL1 — country tracker + Wise stopgap SOP | PASS | both INTL1 artifacts present (cohort-1 enumeration check pending list spec) |
| 21 | INTL2 — marketplace visibility for claimed-but-unpublished tools | PASS | all 7 INTL2 artifacts present; claim route sets listedInMarketplace=true; 40 tests (≥8 required); marketplace query + badge wired; public detail route uses canonical marketplaceInclusionSql |

## Phase 3 Gate — 2026-04-21T22:58:50.688Z

**Verdict:** 9 PASS / 13 DEFER / 5 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | PASS | cron='0 6 * * 0' (weekly Sunday sweep) |
| 8 | Workspace typecheck passes (tsc --noEmit per package) | PASS | apps/web=PASS, packages/mcp=PASS |
| 9 | pnpm -w test passes across workspace (using npm+turbo) | PASS | turbo test exit=0; 10 successful |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 64 across 7 test files |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | PASS | l402.ts present; LND wiring=true; adapter-l402.test.ts has 18 it() blocks |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:09:54.688Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 64 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:10:43.731Z

**Verdict:** 6 PASS / 15 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | DEFER | skipped via --skip-tests |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 64 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:11:52.464Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 64 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:35:02.104Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:36:47.925Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T00:51:24.308Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.PROT1 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.K6/P3.RAIL2 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.PROT1/P3.MKT directory-expansion prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K5 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T13:36:38.390Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.K5 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.RAIL1 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.13 prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K6 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 15/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-22T17:33:22.677Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.K5 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.RAIL1 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.13 prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K6 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 14/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-23T17:41:25.043Z

**Verdict:** 7 PASS / 14 DEFER / 6 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 45 across 7 test files; 4 of 7 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | FAIL | all adapter-l402 tests are contract-level (no LND/voltage env, no fetch mock); integration coverage missing |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.K5 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.RAIL1 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.13 prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K6 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 13/15 expansion prompts have no audit-chain commits — Phase 4 blocked |

## Phase 3 Gate — 2026-04-23T18:10:54.370Z

**Verdict:** 8 PASS / 14 DEFER / 5 FAIL (of 27)
**Mode:** default
**Exit code:** 1

| # | Check | Status | Detail |
|---|-------|--------|--------|
| 1 | ≥75 new templates in open-source-servers/ | FAIL | only 72 new templates (<75) |
| 2 | Templater total cost ≤$300 | PASS | well under $300 cap (70 upper bound) |
| 3 | Templater global reject rate <30% | PASS | 18.1% < 30% |
| 4 | ≥2 WG outreach replies logged (founder-manual verify) | DEFER | replies.md not present at /Users/lex/settlegrid-agents/data/wg-outreach/replies.md — founder has not yet logged replies; P3.5 briefs shipped but outreach emails are founder-sent (not agent-sent) |
| 5 | ≥5 directory submissions sent | FAIL | only 0 submissions logged as sent/accepted (<5). Founder-manual verification: confirm whether submissions were sent but status column not updated |
| 6 | Academy lessons 1-5 published at /learn/academy | PASS | registry slugs=[pricing-your-mcp-server, per-call-vs-subscription, stripe-vs-settlegrid-vs-x402, economics-of-tool-calling, calculate-margin-on-ai-api], body files=5, routes=[all present] |
| 7 | Template CI pipeline running weekly | DEFER | workflow configured locally but not yet on the default branch — push origin/main to unblock first weekly run |
| 8 | Workspace typecheck passes across both repos (tsc --noEmit) | PASS | main:apps/web=PASS, main:packages/mcp=PASS, agents=PASS |
| 9 | Tests pass across both repos | PASS | main:PASS (10 successful); agents:Tests=863 passed (863) |
| 10 | All P3.1–P3.11 audit chains PASS | PASS | checked 11 audit chains across main + agents repos; missing stages: none |
| 11 | MPP adapter wired (≥12 unit tests, Stripe test mode) | PASS | MPPAdapter exported; measured MPP-referencing test blocks = 113 across 8 test files; 5 of 8 test files reference Stripe test-mode context |
| 12 | L402 adapter wired with Voltage backend (≥1 integration test) | PASS | l402.ts present; LND wiring=true; L402 test files found=2; total it() blocks=104; integration-test markers matched: 2 of 8 |
| 13 | Consumer SDK shipped (packages/client/ builds, ≥18 unit tests) | DEFER | packages/client/ missing — P3.K3 prompt not yet shipped |
| 14 | Per-rail pricing + unified ledger + tool-secret auth + verifyWebhook in SDK | FAIL | missing: verifyWebhook in SDK, ledger_entries migration SQL, adapter-dispatch → ledger wiring |
| 15 | DRAIN keccak-256 fix OR removal | FAIL | drain.ts still uses sha256 stand-in or lacks keccak vector test — see P3.K5 |
| 16 | Stripe account-type router + eligibility pre-check + waitlist shipped | FAIL | partial: missing packages/rails/src/router.ts, stripe-connect-countries.json, /api/eligibility — see P3.RAIL1 |
| 17 | Stripe Connect reconciliation + drift detection | DEFER | missing: reconcile-stripe.ts, daily cron workflow, dry-run report |
| 18 | Payout schedule config + chargeback velocity monitoring | DEFER | missing: /dashboard/payouts page, chargeback-velocity.ts, /dashboard/admin/chargeback-watch, chargeback_alerts table |
| 19 | Python SDK core (packages/sdk-python/ builds + pip install -e .) | DEFER | packages/sdk-python/ missing — P3.PYTHON1 prompt not yet shipped |
| 20 | Python SDK test parity ≥90% of TS SDK + CI matrix 3.10/3.11/3.12 | DEFER | packages/sdk-python/ missing; cascades from C19 |
| 21 | settlegrid-langchain Python adapter (≥8 tests) | DEFER | no Python settlegrid-langchain package — P3.PYTHON3 prompt not yet shipped |
| 22 | settlegrid-llamaindex + crewai + pydantic-ai Python adapters | DEFER | missing packages — P3.PYTHON4 prompt not yet shipped |
| 23 | settlegrid-dspy + smolagents Python adapters | DEFER | missing packages — P3.PYTHON5 prompt not yet shipped |
| 24 | Mastercard VI detection stub (adapter + landing page) | DEFER | /protocols/mastercard-vi page not built yet — P3.PROT1 prompt not yet shipped |
| 25 | cursor.directory submission packet | DEFER | cursor.directory packet missing — P3.13 prompt not yet shipped |
| 26 | Pre-execution authorization gate (authorize.ts + kernel wiring + ≥20 tests) | DEFER | packages/mcp/src/authorize.ts missing — P3.K6 prompt not yet shipped |
| 27 | All settlement-layer expansion audit chains PASS | DEFER | 13/15 expansion prompts have no audit-chain commits — Phase 4 blocked |
