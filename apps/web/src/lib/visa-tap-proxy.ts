/**
 * Visa TAP (Trusted Agent Protocol) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/tap.ts
 */

import {
  TAPAdapter,
  isVisaTapRequest as isVisaTapRequestCore,
  validateVisaTapPayment as validateVisaTapPaymentCore,
  generateVisaTap402Response as generateVisaTap402ResponseCore,
} from '@settlegrid/mcp'
import type {
  VisaTapPaymentResult,
  VisaTapToolConfig,
  VisaTapErrorCode, AdapterLogger } from '@settlegrid/mcp'
import {
  isVisaTapEnabled,
  getVisaApiUrl,
  getVisaApiKey,
  getVisaSharedSecret,
  getAppUrl,
} from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const tapAdapter = new TAPAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

export function isVisaTapRequest(request: Request): boolean {
  return isVisaTapRequestCore(request)
}

export async function validateVisaTapPayment(
  request: Request,
  toolConfig: VisaTapToolConfig,
): Promise<VisaTapPaymentResult> {
  return validateVisaTapPaymentCore(request, {
    enabled: isVisaTapEnabled(),
    toolConfig,
    visaApiUrl: getVisaApiUrl(),
    visaApiKey: getVisaApiKey(),
    visaSharedSecret: getVisaSharedSecret(),
    logger: appLogger,
  })
}

export function generateVisaTap402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  merchantId?: string,
): Response {
  return generateVisaTap402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    merchantId,
    appUrl: getAppUrl(),
  })
}

export { tapAdapter }
export type { VisaTapPaymentResult, VisaTapToolConfig, VisaTapErrorCode }
