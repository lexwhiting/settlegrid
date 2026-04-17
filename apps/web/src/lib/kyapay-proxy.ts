/**
 * KYAPay (Skyfire — Visa Intelligent Commerce) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/kyapay.ts
 */

import {
  KyaPayAdapter,
  validateKyaPayPayment as validateKyaPayPaymentCore,
  generateKyaPay402Response as generateKyaPay402ResponseCore,
} from '@settlegrid/mcp'
import type {
  KyaPayPaymentResult,
  KyaPayToolConfig,
  KyaPayErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isKyaPayEnabled, getKyaPayVerificationKey, getAppUrl } from './env'
import { logger } from './logger'

const kyapayAdapter = new KyaPayAdapter()

const appLogger: AdapterLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isKyaPayRequest(request: Request): boolean {
  return kyapayAdapter.canHandle(request)
}

export { isKyaPayEnabled }

export async function validateKyaPayPayment(
  request: Request,
  toolConfig: KyaPayToolConfig,
): Promise<KyaPayPaymentResult> {
  return validateKyaPayPaymentCore(request, {
    enabled: isKyaPayEnabled(),
    toolConfig,
    verificationKey: getKyaPayVerificationKey(),
    logger: appLogger,
  })
}

export function generateKyaPay402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateKyaPay402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
  })
}

export { kyapayAdapter }
export type { KyaPayPaymentResult, KyaPayToolConfig, KyaPayErrorCode }
