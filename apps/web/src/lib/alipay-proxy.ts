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
  AlipayErrorCode,
} from '@settlegrid/mcp'
import { isAlipayEnabled, getAppUrl } from './env'
import { logger } from './logger'

const alipayAdapter = new AlipayAdapter()

const appLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

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
