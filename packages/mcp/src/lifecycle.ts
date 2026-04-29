/**
 * @settlegrid/mcp — Lifecycle API stubs (P2.K4).
 *
 * Per settlement-layer-architecture.md, the SDK needs a lifecycle API
 * for streaming and long-running invocations. Today (Phase 2) the
 * kernel runs invocations synchronously — `sg.wrap` opens a session,
 * runs the handler, meters, done. For streaming generation (chat
 * completions, long-running tool calls), the invocation model needs to
 * support:
 *
 *   1. `beginInvocation(ctx)` — open an invocation, return an
 *      `Invocation` record with status `'pending'`. Reserves budget
 *      (checks `maxCostCents` if set) but does not charge yet.
 *   2. `heartbeat(inv)` — periodic keep-alive so an operator timeout
 *      policy can distinguish a live long-running invocation from a
 *      crashed one. Updates `heartbeatAt`.
 *   3. `settleInvocation(inv, { costCents })` — terminal success:
 *      deduct `costCents` from the consumer balance, set status
 *      `'settled'`, record `settledAt`.
 *   4. `voidInvocation(inv, reason)` — terminal cancel: release any
 *      reservation, no charge, status `'voided'`.
 *
 * P2.K4 ships ONLY the types + stub function references. Each stub
 * throws `NOT_IMPLEMENTED — see P3.K1`. The purpose is to:
 *
 *   - Let Phase 2 consumers start writing code against the lifecycle
 *     shape without waiting on Phase 3.
 *   - Surface the function names in the bundled adapter surface so
 *     the Phase 2 gate's check 12 (presence check) flips PASS.
 *   - Freeze the function signatures before implementation begins
 *     so P3.K1 is a body-only change.
 *
 * P3.K1 will replace each stub body with the real lifecycle logic
 * (reservation, heartbeat tracking, atomic settle/void against the
 * balance ledger, timeout policy enforcement).
 *
 * @packageDocumentation
 */

import type { MeterContext, Invocation } from './types'

// Re-export the types so `packages/mcp/src/lifecycle.ts` is the
// canonical module surface for the lifecycle API (types + functions
// in one place). The Phase 2 gate's check 12 scans this file for the
// 5 identifiers `MeterContext`, `beginInvocation`, `settleInvocation`,
// `voidInvocation`, `heartbeat` — both the import above and the
// function declarations below satisfy the regex.
export type { MeterContext, Invocation }

/**
 * Sentinel error message shared by all 4 stubs. Tests assert on this
 * to verify that (a) the stub throws, (b) it carries the P3.K1
 * breadcrumb so callers reading the error know where the real
 * implementation is tracked. Extracted as a constant so the exact
 * wording is refactor-safe — P3.K1 will remove the throws entirely,
 * and having a single reference point makes the diff small.
 */
export const LIFECYCLE_NOT_IMPLEMENTED_MSG =
  'NOT_IMPLEMENTED — see P3.K1'

/**
 * Machine-readable error code attached to every stub throw. Exposed as
 * a constant so callers can do `err.code === LIFECYCLE_NOT_IMPLEMENTED_CODE`
 * in catch blocks (a subset-match pattern that doesn't depend on the
 * message string surviving future refactors). Aligned with the
 * UPPER_SNAKE convention the SDK already uses for `SettleGridErrorCode`
 * without adding this value to that closed union — the lifecycle stubs
 * are scaffolding that P3.K1 deletes entirely, so growing the public
 * error-code union for a transient signal would be wrong.
 *
 * Hostile-review L2: thrown errors now carry `.code` so external code
 * using the SettleGridError-style catch pattern doesn't miss them.
 */
export const LIFECYCLE_NOT_IMPLEMENTED_CODE = 'NOT_IMPLEMENTED' as const

/**
 * Shared throw-site for all 4 lifecycle stubs. Builds an `Error` with
 * the sentinel message + a `.code` property so catch blocks can match
 * on either surface:
 *
 *   try { sg.beginInvocation(ctx) }
 *   catch (e) {
 *     if ((e as { code?: string }).code === 'NOT_IMPLEMENTED') { ... }
 *     // OR
 *     if ((e as Error).message.includes('P3.K1')) { ... }
 *   }
 *
 * Using a single throw site means the Error prototype chain, message,
 * and code are identical across all 4 stubs — tests can share
 * assertions and P3.K1's "remove the throw" diff is minimal.
 */
function notImplementedError(): Error & { code: typeof LIFECYCLE_NOT_IMPLEMENTED_CODE } {
  const err = new Error(LIFECYCLE_NOT_IMPLEMENTED_MSG) as Error & {
    code: typeof LIFECYCLE_NOT_IMPLEMENTED_CODE
  }
  err.code = LIFECYCLE_NOT_IMPLEMENTED_CODE
  return err
}

/**
 * Options for {@link beginInvocation}. `method` is used for pricing
 * resolution; `units` carries the billable multiple for non-
 * per-invocation pricing models (per-token, per-byte, per-second,
 * tiered). Both mirror the fields in `WrapOptions`.
 */
export interface BeginInvocationOptions {
  method?: string
  units?: number
}

/**
 * Open an invocation. P3.K1 will: validate the API key, reserve the
 * expected cost (checking `meterContext.maxCostCents` if set), and
 * return an `Invocation` record with status `'pending'`. Throwing
 * `InsufficientCreditsError` / `BudgetExceededError` / `InvalidKeyError`
 * if any precondition fails.
 *
 * @throws Error `NOT_IMPLEMENTED — see P3.K1` (P2.K4 stub).
 */
export function beginInvocation(
  _meterContext: MeterContext,
  _options?: BeginInvocationOptions,
): Invocation {
  throw notImplementedError()
}

/**
 * Options for {@link settleInvocation}. `costCents` lets the caller
 * override the reserved cost at settle time (useful for pricing
 * models where the final amount is only known after handler
 * completion — per-token, per-byte, etc.).
 */
export interface SettleInvocationOptions {
  costCents?: number
  metadata?: Record<string, unknown>
}

/**
 * Terminal success: charge the consumer, mark the invocation
 * settled. P3.K1 will implement the atomic balance deduction +
 * invocation-table write. Idempotent by `invocation.id`.
 *
 * @throws Error `NOT_IMPLEMENTED — see P3.K1` (P2.K4 stub).
 */
export function settleInvocation(
  _invocation: Invocation,
  _options?: SettleInvocationOptions,
): void {
  throw notImplementedError()
}

/**
 * Terminal cancel: release any reservation, record the void reason,
 * no charge. Used when a handler throws before producing billable
 * output, when the consumer cancels a streaming call, or when a
 * timeout elapses.
 *
 * @throws Error `NOT_IMPLEMENTED — see P3.K1` (P2.K4 stub).
 */
export function voidInvocation(
  _invocation: Invocation,
  _reason?: string,
): void {
  throw notImplementedError()
}

/**
 * Periodic keep-alive for long-running invocations. P3.K1 will
 * advance `heartbeatAt` on the invocation record so an operator-side
 * timeout sweeper can distinguish live work from crashed clients.
 * Throws if called against a terminal-state invocation.
 *
 * @throws Error `NOT_IMPLEMENTED — see P3.K1` (P2.K4 stub).
 */
export function heartbeat(_invocation: Invocation): void {
  throw notImplementedError()
}
