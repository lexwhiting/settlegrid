/**
 * ACP (Agentic Commerce Protocol — Stripe + OpenAI) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/acp.ts
 */

import {
  ACPAdapter,
  isAcpRequest as isAcpRequestCore,
  validateAcpPayment as validateAcpPaymentCore,
  generateAcp402Response as generateAcp402ResponseCore,
} from '@settlegrid/mcp'
import type { AcpPaymentResult, AcpToolConfig, AcpErrorCode } from '@settlegrid/mcp'
import { isAcpEnabled, getAcpStripeKey, getAppUrl } from './env'
import { logger } from './logger'

const acpAdapter = new ACPAdapter()

const appLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isAcpRequest(request: Request): boolean {
  return isAcpRequestCore(request)
}

export async function validateAcpPayment(
  request: Request,
  toolConfig: AcpToolConfig,
): Promise<AcpPaymentResult> {
  return validateAcpPaymentCore(request, {
    enabled: isAcpEnabled(),
    toolConfig,
    acpStripeKey: getAcpStripeKey(),
    logger: appLogger,
  })
}

export function generateAcp402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
  recipientId?: string,
): Response {
  return generateAcp402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    recipientId,
    appUrl: getAppUrl(),
  })
}

export { acpAdapter }
export type { AcpPaymentResult, AcpToolConfig, AcpErrorCode }
