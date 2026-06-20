/**
 * MPP (Machine Payments Protocol) — app-side thin re-export (P2.K2).
 *
 * The full protocol logic (detection, validation, 402 generation) lives in
 * `@settlegrid/mcp/adapters/mpp`. This file binds app-side env + logger to
 * the adapter module so existing route.ts code keeps the same public API
 * (`isMppRequest`, `validateMppPayment`, `generateMpp402Response`).
 *
 * @see packages/mcp/src/adapters/mpp.ts
 */

import {
  MPPAdapter,
  isMppRequest as isMppRequestCore,
  validateMppPayment as validateMppPaymentCore,
  generateMpp402Response as generateMpp402ResponseCore,
} from '@settlegrid/mcp'
import type { MppPaymentResult, MppToolConfig, MppErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isMppEnabled, getStripeMppSecret, getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const mppAdapter = new MPPAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

/** Check if a request contains MPP payment headers. */
export function isMppRequest(request: Request): boolean {
  return isMppRequestCore(request)
}

/** Validate an incoming MPP payment from a Stripe Shared Payment Token. */
export async function validateMppPayment(
  request: Request,
  toolConfig: MppToolConfig,
): Promise<MppPaymentResult> {
  return validateMppPaymentCore(request, {
    enabled: isMppEnabled(),
    stripeMppSecret: getStripeMppSecret(),
    toolConfig,
    logger: appLogger,
  })
}

/** Generate an MPP 402 Payment Required response. */
export function generateMpp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientId?: string,
): Response {
  return generateMpp402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    recipientId,
    appUrl: getAppUrl(),
  })
}

// Public adapter instance for callers that want direct access.
export { mppAdapter }

// Type re-exports so callers importing from `@/lib/mpp` keep working.
export type { MppPaymentResult, MppToolConfig, MppErrorCode }

// Some callers reference `MppPaymentResult` through an aliased name, keep
// the barrel flat by re-exporting the core types at their well-known names.
