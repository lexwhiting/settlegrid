/**
 * P2.K1 — Unified-adapter dispatch helper for the marketplace proxy.
 *
 * Spec deviation note: P2.K1's "Files you may touch" list only includes
 * route.ts, lib/env.ts, and .env.example. This helper file is a forced
 * deviation because Next.js App Router rejects any non-handler export
 * from a route.ts file (TS2344: must satisfy `{ [x: string]: never }`).
 * The `decideUnifiedDispatch` function MUST be exported so unit tests
 * can verify equivalence against the legacy isXRequest() helpers.
 *
 * The `_` filename prefix is Next.js's convention for files that must
 * not be treated as route segments. Tests live at
 * __tests__/unified-dispatch.test.ts (also a Next.js-recognized
 * private path).
 */

import { protocolRegistry } from '@settlegrid/mcp'

// ProtocolName + PaymentContext aren't re-exported from @settlegrid/mcp's
// public index (P2.K1 may not modify packages/mcp), so we derive them
// locally from the runtime API surface. Drift-safe: any change to the
// adapter shape is picked up by tsc.
type _DetectedAdapter = NonNullable<ReturnType<typeof protocolRegistry.detect>>
export type ProtocolName = _DetectedAdapter['name']
export type PaymentContext = Awaited<ReturnType<_DetectedAdapter['extractPaymentContext']>>

export type DispatchDecision =
  | { type: 'unified'; protocol: ProtocolName; paymentContext?: PaymentContext }
  | { type: 'mcp-fallback' }
  | { type: 'no-match' }

/**
 * Pure dispatch decision — given a Request, asks the adapter registry
 * which protocol applies. Side-effect-free beyond reading the request.
 *
 * Returns:
 *   - { type: 'unified', protocol, paymentContext? } when a non-mcp
 *     adapter matches. paymentContext is included for observability /
 *     P2.K3 snapshot comparison; absence indicates extraction threw
 *     (the legacy handler will re-extract and surface the protocol error).
 *   - { type: 'mcp-fallback' } when the mcp adapter matches (catch-all
 *     for x-api-key auth — corresponds to the standard API key flow,
 *     NOT a separate handler).
 *   - { type: 'no-match' } when no adapter claims the request — caller
 *     should fall through to the legacy chain (emerging protocols) or
 *     the standard API key flow.
 */
export async function decideUnifiedDispatch(
  request: Request,
): Promise<DispatchDecision> {
  // Defensive: protocolRegistry.detect() iterates DETECTION_PRIORITY
  // and calls each adapter's canHandle(). canHandle is supposed to be
  // header-only and pure, but a malformed header could trip a regex
  // or parser inside a future external adapter. Treat any throw as
  // "no match" so the legacy chain handles the request.
  let adapter: ReturnType<typeof protocolRegistry.detect>
  try {
    adapter = protocolRegistry.detect(request)
  } catch {
    return { type: 'no-match' }
  }
  if (!adapter) {
    return { type: 'no-match' }
  }
  if (adapter.name === 'mcp') {
    return { type: 'mcp-fallback' }
  }
  let paymentContext: PaymentContext | undefined
  try {
    // Belt-and-suspenders: clone the request before passing to
    // extractPaymentContext. All 9 adapters in @settlegrid/mcp
    // currently clone internally (verified 2026-04-16), but the
    // ProtocolAdapter contract doesn't *require* internal cloning.
    // A future external adapter that forgets would silently corrupt
    // the body for every request — a particularly nasty bug because
    // it would only surface as wrong responses in P2.K3 snapshot
    // diffs, not as test failures.
    paymentContext = await adapter.extractPaymentContext(request.clone())
  } catch {
    // Swallow — the legacy handler will re-extract and produce the
    // canonical protocol error response. We only use the context for
    // observability + P2.K3 snapshot comparison.
  }
  return { type: 'unified', protocol: adapter.name, paymentContext }
}
