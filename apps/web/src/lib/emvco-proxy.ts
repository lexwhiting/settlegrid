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
  EmvcoNetwork, AdapterLogger } from '@settlegrid/mcp'
import { isEmvcoEnabled, getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const emvcoAdapter = new EmvcoAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

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
