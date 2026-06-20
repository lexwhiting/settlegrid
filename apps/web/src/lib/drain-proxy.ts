/**
 * DRAIN (Off-chain USDC via EIP-712 vouchers) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/drain.ts
 */

import {
  DrainAdapter,
  validateDrainPayment as validateDrainPaymentCore,
  generateDrain402Response as generateDrain402ResponseCore,
} from '@settlegrid/mcp'
import type {
  DrainPaymentResult,
  DrainToolConfig,
  DrainErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isDrainEnabled, getDrainChannelAddress, getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const drainAdapter = new DrainAdapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

export function isDrainRequest(request: Request): boolean {
  return drainAdapter.canHandle(request)
}

export { isDrainEnabled }

export async function validateDrainPayment(
  request: Request,
  toolConfig: DrainToolConfig,
): Promise<DrainPaymentResult> {
  return validateDrainPaymentCore(request, {
    enabled: isDrainEnabled(),
    toolConfig,
    configuredChannelAddress: getDrainChannelAddress(),
    logger: appLogger,
  })
}

export function generateDrain402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  return generateDrain402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
    channelAddress: getDrainChannelAddress(),
  })
}

export { drainAdapter }
export type { DrainPaymentResult, DrainToolConfig, DrainErrorCode }
