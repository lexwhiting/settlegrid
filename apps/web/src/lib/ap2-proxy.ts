/**
 * AP2 (Google Agentic Payments) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/ap2.ts
 */

import {
  AP2Adapter,
  isAp2Request as isAp2RequestCore,
  validateAp2Payment as validateAp2PaymentCore,
  generateAp2_402Response as generateAp2_402ResponseCore,
} from '@settlegrid/mcp'
import type { Ap2PaymentResult, Ap2ToolConfig, Ap2ErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isAp2Enabled, getAp2SigningSecret, getAppUrl } from './env'
import { logger } from './logger'

const ap2Adapter = new AP2Adapter()

const appLogger: AdapterLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isAp2Request(request: Request): boolean {
  return isAp2RequestCore(request)
}

export async function validateAp2Payment(
  request: Request,
  toolConfig: Ap2ToolConfig,
): Promise<Ap2PaymentResult> {
  return validateAp2PaymentCore(request, {
    enabled: isAp2Enabled(),
    toolConfig,
    signingSecret: getAp2SigningSecret(),
    logger: appLogger,
  })
}

export function generateAp2_402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  merchantId?: string,
): Response {
  return generateAp2_402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    merchantId,
    appUrl: getAppUrl(),
  })
}

export { ap2Adapter }
export type { Ap2PaymentResult, Ap2ToolConfig, Ap2ErrorCode }
