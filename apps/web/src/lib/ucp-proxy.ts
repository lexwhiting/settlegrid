/**
 * UCP (Universal Commerce Protocol) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/ucp.ts
 */

import {
  UCPAdapter,
  isUcpRequest as isUcpRequestCore,
  validateUcpPayment as validateUcpPaymentCore,
  generateUcp402Response as generateUcp402ResponseCore,
} from '@settlegrid/mcp'
import type { UcpPaymentResult, UcpToolConfig, UcpErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { getAppUrl } from './env'
import { logger } from './logger'

const ucpAdapter = new UCPAdapter()

const appLogger: AdapterLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isUcpRequest(request: Request): boolean {
  return isUcpRequestCore(request)
}

/** UCP enable check — env.ts does not expose one, defined here. */
export function isUcpEnabled(): boolean {
  return !!process.env.UCP_API_KEY
}

export async function validateUcpPayment(
  request: Request,
  toolConfig: UcpToolConfig,
): Promise<UcpPaymentResult> {
  return validateUcpPaymentCore(request, {
    enabled: isUcpEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

export function generateUcp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateUcp402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
  })
}

export { ucpAdapter }
export type { UcpPaymentResult, UcpToolConfig, UcpErrorCode }
