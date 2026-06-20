/**
 * Alipay ACTP (Agentic Commerce Trust Protocol) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/alipay.ts
 */

import {
  AlipayAdapter,
  validateAlipayPayment as validateAlipayPaymentCore,
  generateAlipay402Response as generateAlipay402ResponseCore,
} from '@settlegrid/mcp'
import type {
  AlipayPaymentResult,
  AlipayToolConfig,
  AlipayErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isAlipayEnabled, getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const alipayAdapter = new AlipayAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

export function isAlipayRequest(request: Request): boolean {
  return alipayAdapter.canHandle(request)
}

export { isAlipayEnabled }

export async function validateAlipayPayment(
  request: Request,
  toolConfig: AlipayToolConfig,
): Promise<AlipayPaymentResult> {
  return validateAlipayPaymentCore(request, {
    enabled: isAlipayEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

export function generateAlipay402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateAlipay402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
  })
}

export { alipayAdapter }
export type { AlipayPaymentResult, AlipayToolConfig, AlipayErrorCode }
