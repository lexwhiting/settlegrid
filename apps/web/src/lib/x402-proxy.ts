/**
 * x402 Protocol — app-side thin re-export (P2.K2).
 *
 * The full protocol logic lives in `@settlegrid/mcp/adapters/x402`. This
 * file binds app-side env + logger so existing route.ts code keeps the same
 * public API (`isX402Request`, `validateX402Payment`, `generateX402_402Response`).
 *
 * @see packages/mcp/src/adapters/x402.ts
 */

import {
  X402Adapter,
  isX402Request as isX402RequestCore,
  validateX402Payment as validateX402PaymentCore,
  generateX402_402Response as generateX402_402ResponseCore,
} from '@settlegrid/mcp'
import type {
  X402ProxyPaymentResult,
  X402ToolConfig,
  X402ProxyErrorCode,
} from '@settlegrid/mcp'
import { isX402Enabled, getX402FacilitatorUrl, getAppUrl } from './env'
import { logger } from './logger'

const x402Adapter = new X402Adapter()

const appLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isX402Request(request: Request): boolean {
  return isX402RequestCore(request)
}

export async function validateX402Payment(
  request: Request,
  toolConfig: X402ToolConfig,
): Promise<X402ProxyPaymentResult> {
  return validateX402PaymentCore(request, {
    enabled: isX402Enabled(),
    toolConfig,
    facilitatorUrl: getX402FacilitatorUrl(),
    logger: appLogger,
  })
}

export function generateX402_402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientAddress?: string,
): Response {
  return generateX402_402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    recipientAddress,
    appUrl: getAppUrl(),
    fallbackPaymentAddress: process.env.SETTLEGRID_PAYMENT_ADDRESS,
  })
}

export { x402Adapter }
export type { X402ProxyPaymentResult, X402ToolConfig, X402ProxyErrorCode }
