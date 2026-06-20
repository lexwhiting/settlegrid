/**
 * Mastercard Verifiable Intent — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/mastercard-vi.ts
 */

import {
  MastercardVIAdapter,
  isMastercardRequest as isMastercardRequestCore,
  validateMastercardPayment as validateMastercardPaymentCore,
  generateMastercard402Response as generateMastercard402ResponseCore,
} from '@settlegrid/mcp'
import type {
  MastercardPaymentResult,
  MastercardToolConfig,
  MastercardErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

/**
 * P3.PROT1 — exported so the proxy route can build the 503 detection-stub
 * response for `MC_NOT_YET_SUPPORTED` outcomes via
 * ``mastercardAdapter.buildDetectionStubResponse()``.
 */
export const mastercardAdapter = new MastercardVIAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

export function isMastercardRequest(request: Request): boolean {
  return isMastercardRequestCore(request)
}

/** Mastercard enable check — env.ts does not expose one, defined here. */
export function isMastercardEnabled(): boolean {
  return !!process.env.MASTERCARD_API_KEY
}

export async function validateMastercardPayment(
  request: Request,
  toolConfig: MastercardToolConfig,
): Promise<MastercardPaymentResult> {
  return validateMastercardPaymentCore(request, {
    enabled: isMastercardEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

export function generateMastercard402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  merchantId?: string,
): Response {
  return generateMastercard402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    merchantId,
    appUrl: getAppUrl(),
  })
}

export type { MastercardPaymentResult, MastercardToolConfig, MastercardErrorCode }
