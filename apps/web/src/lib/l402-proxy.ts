/**
 * L402 (Bitcoin Lightning) — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/l402.ts
 */

import {
  L402Adapter,
  validateL402Payment as validateL402PaymentCore,
  generateL402_402Response as generateL402_402ResponseCore,
} from '@settlegrid/mcp'
import type { L402PaymentResult, L402ToolConfig, L402ErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isL402Enabled, getLndRestUrl, getLndMacaroonHex, getAppUrl } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const l402Adapter = new L402Adapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

function getSigningKey(): string | undefined {
  return process.env.LND_MACAROON_HEX ?? process.env.L402_SIGNING_KEY
}

export function isL402Request(request: Request): boolean {
  return l402Adapter.canHandle(request)
}

export { isL402Enabled }

export async function validateL402Payment(
  request: Request,
  toolConfig: L402ToolConfig,
): Promise<L402PaymentResult> {
  return validateL402PaymentCore(request, {
    enabled: isL402Enabled(),
    toolConfig,
    signingKey: getSigningKey(),
    logger: appLogger,
  })
}

export async function generateL402_402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Promise<Response> {
  const btcUsdRate = parseInt(process.env.L402_BTC_USD_RATE ?? '100000', 10)
  return generateL402_402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
    signingKey: getSigningKey(),
    lndRestUrl: getLndRestUrl(),
    lndMacaroonHex: getLndMacaroonHex(),
    btcUsdRate: Number.isFinite(btcUsdRate) ? btcUsdRate : undefined,
    logger: appLogger,
  })
}

export { l402Adapter }
export type { L402PaymentResult, L402ToolConfig, L402ErrorCode }
