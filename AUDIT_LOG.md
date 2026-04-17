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
