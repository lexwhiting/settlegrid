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
  X402ProxyErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isX402Enabled, getAppUrl, getX402PaymentAddress } from './env'
import { createSanitizingAdapterLogger } from './sanitizing-adapter-logger'

const x402Adapter = new X402Adapter()

const appLogger: AdapterLogger = createSanitizingAdapterLogger()

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
    // D1: the proxy settles x402 IN-PROCESS via executeX402Settlement (the shared
    // EIP-3009 engine), never via an external facilitator round-trip — so this
    // structural gate must NOT settle. Omitting facilitatorUrl keeps it a pure
    // structural accept (valid, NO txHash, no on-chain side effect), making the
    // orchestrator the sole settle path. The standalone public facilitator routes
    // (/api/x402/{settle,facilitator/...}) are a separate surface.
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
    // Advertise the SAME trimmed value the proxy settlement verifier ENFORCES as
    // the payee (getX402PaymentAddress), so a trailing-newline env can't make the
    // 402's payTo diverge from the bound recipient (which would reject a
    // spec-conformant payer as WRONG_RECIPIENT — a self-inflicted 402 loop).
    fallbackPaymentAddress: getX402PaymentAddress(),
  })
}

export { x402Adapter }
export type { X402ProxyPaymentResult, X402ToolConfig, X402ProxyErrorCode }
