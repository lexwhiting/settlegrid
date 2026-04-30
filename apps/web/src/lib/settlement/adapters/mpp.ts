/**
 * @deprecated Layer A re-export stub (P3.K1).
 *
 * The legacy Layer A implementation of MPPAdapter (180+ lines of SPT
 * validation + 402 generation) was deleted in P3.K1. The canonical
 * adapter now lives in `@settlegrid/mcp` — see
 * `packages/mcp/src/adapters/mpp.ts`.
 *
 * This 1-line re-export is preserved at the legacy path for three
 * reasons:
 *
 *   1. Keep `apps/web/src/lib/settlement/index.ts` barrel re-export
 *      source-compatible for any external consumer still importing
 *      `MPPAdapter` from `@/lib/settlement`.
 *   2. Keep the sibling auto-registration in
 *      `apps/web/src/lib/settlement/adapters/index.ts` compilable
 *      without further edits.
 *   3. Satisfy the marketing-claim verification test
 *      `apps/web/src/app/__tests__/compare-nevermined.test.ts`
 *      which asserts Layer A holds exactly 9 adapter files — a
 *      count the marketing copy cites.
 *
 * The file contains NO adapter logic of its own. All MPP behavior
 * lives in `@settlegrid/mcp`. Layer A retires entirely in P2.K1.
 */
export { MPPAdapter } from '@settlegrid/mcp'
