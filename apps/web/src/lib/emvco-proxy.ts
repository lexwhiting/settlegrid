/**
 * EMVCo Agent Payments — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/emvco.ts
 */

import {
  EmvcoAdapter,
  validateEmvcoPayment as validateEmvcoPaymentCore,
  generateEmvco402Response as generateEmvco402ResponseCore,
} from '@settlegrid/mcp'
import type {
  EmvcoPaymentResult,
  EmvcoToolConfig,
  EmvcoErrorCode,
  EmvcoNetwork,
} from '@settlegrid/mcp'
import { isEmvcoEnabled, getAppUrl } from './env'
import { logger } from './logger'

const emvcoAdapter = new EmvcoAdapter()

const appLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isEmvcoRequest(request: Request): boolean {
  return emvcoAdapter.canHandle(request)
}

export { isEmvcoEnabled }

export async function validateEmvcoPayment(
  request: Request,
  toolConfig: EmvcoToolConfig,
): Promise<EmvcoPaymentResult> {
  return validateEmvcoPaymentCore(request, {
    enabled: isEmvcoEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

export function generateEmvco402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateEmvco402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
  })
}

export { emvcoAdapter }
export type { EmvcoPaymentResult, EmvcoToolConfig, EmvcoErrorCode, EmvcoNetwork }
