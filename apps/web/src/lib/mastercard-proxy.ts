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
import { logger } from './logger'

const mastercardAdapter = new MastercardVIAdapter()

const appLogger: AdapterLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

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

export { mastercardAdapter }
export type { MastercardPaymentResult, MastercardToolConfig, MastercardErrorCode }
