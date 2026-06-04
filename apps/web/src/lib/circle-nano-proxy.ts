/**
 * Circle Nanopayments — app-side thin re-export (P2.K2).
 *
 * @see packages/mcp/src/adapters/circle-nano.ts
 */

import {
  CircleNanoAdapter,
  isCircleNanoRequest as isCircleNanoRequestCore,
  validateCircleNanoPayment as validateCircleNanoPaymentCore,
  parseCircleNanoProof,
  generateCircleNano402Response as generateCircleNano402ResponseCore,
} from '@settlegrid/mcp'
import type {
  CircleNanoPaymentResult,
  CircleNanoToolConfig,
  CircleNanoErrorCode, AdapterLogger } from '@settlegrid/mcp'
import { isAddress } from 'viem'
import { getAppUrl, getCircleNanoRecipient } from './env'
import { verifyCircleNanoAuthorization, USDC_EIP712_DOMAINS } from './settlement/circle-nano/verify'
import { USDC_ADDRESSES } from './settlement/x402/types'
import { logger } from './logger'

/** 1 US cent = 10,000 USDC base units (USDC has 6 decimals). */
const USDC_BASE_UNITS_PER_CENT = 10_000n

const circleNanoAdapter = new CircleNanoAdapter()

const appLogger: AdapterLogger = {
  info: (event: string, data?: Record<string, unknown>) => logger.info(event, data ?? {}),
  warn: (event: string, data?: Record<string, unknown>) => logger.warn(event, data ?? {}),
  error: (event: string, data?: Record<string, unknown>, err?: unknown) =>
    logger.error(event, data ?? {}, err),
}

export function isCircleNanoRequest(request: Request): boolean {
  return isCircleNanoRequestCore(request)
}

/** Circle Nano enable check — env.ts does not expose one, defined here. */
export function isCircleNanoEnabled(): boolean {
  return !!process.env.CIRCLE_NANO_API_KEY
}

export async function validateCircleNanoPayment(
  request: Request,
  toolConfig: CircleNanoToolConfig,
): Promise<CircleNanoPaymentResult> {
  return validateCircleNanoPaymentCore(request, {
    enabled: isCircleNanoEnabled(),
    toolConfig,
    logger: appLogger,
  })
}

/**
 * P5 — credential-string verifier for the kernel facilitator verify/settle
 * routes (`/api/circle-nano/{verify,settle}`), which receive the EIP-3009
 * authorization in `paymentContext.payment.proof` rather than request headers.
 *
 * Unlike {@link validateCircleNanoPayment} (the structural SDK check), this is
 * the AUTHORITATIVE offline verification: decode the proof, then recover the
 * EIP-712 signer and enforce payee == SETTLEGRID_USDC_RECIPIENT, the time
 * window, and the authorized amount via {@link verifyCircleNanoAuthorization}.
 * Enabled by the recipient env alone — no Circle account or API key required.
 */
export async function validateCircleNanoCredentialString(
  proof: string | null,
  toolConfig: CircleNanoToolConfig,
): Promise<CircleNanoPaymentResult> {
  const recipient = getCircleNanoRecipient()
  if (!recipient || !isAddress(recipient, { strict: false })) {
    if (recipient) {
      // Set-but-invalid: fail closed LOUDLY so a misconfigured deploy is
      // diagnosable instead of silently rejecting every payment as wrong-payee.
      appLogger.warn('circle_nano.recipient_misconfigured', {
        recipientPrefix: recipient.slice(0, 10),
      })
    }
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_NOT_CONFIGURED',
        message:
          'Circle Nanopayments are not configured on this SettleGrid instance (SETTLEGRID_USDC_RECIPIENT missing or not a valid address).',
      },
    }
  }
  if (!proof) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_MISSING',
        message:
          'No Circle Nanopayment authorization found. Provide an EIP-3009 transferWithAuthorization.',
      },
    }
  }

  const parsed = parseCircleNanoProof(proof)
  if (!parsed) {
    return {
      valid: false,
      error: {
        code: 'CIRCLE_NANO_AUTH_INVALID',
        message: 'Malformed circle-nano authorization payload.',
      },
    }
  }

  const requiredBaseUnits =
    BigInt(Math.max(0, Math.floor(toolConfig.costCents))) * USDC_BASE_UNITS_PER_CENT
  const result = await verifyCircleNanoAuthorization(parsed, {
    recipient,
    requiredBaseUnits,
    // Enforce-exact: circle-nano now requires value === cost (parity with x402).
    // EIP-3009 transfers the FULL signed value atomically, so tolerating value >
    // cost over-collected the payer (the excess was silently retained, dev credited
    // only cost). The SDK already advertises exactly cost (adapters/circle-nano.ts),
    // so only anomalous over-authorizations are rejected (CIRCLE_NANO_AMOUNT_MISMATCH).
    // This one gate covers all three settling paths: kernel /verify, kernel /settle,
    // and the direct proxy handleCircleNanoProxy.
    exactAmount: true,
  })

  if (!result.valid) {
    // Rejection is logged by the callers (the verify/settle routes + the
    // legacy proxy handler) with their own event names; no duplicate log here.
    return {
      valid: false,
      error: {
        code: result.errorCode ?? 'CIRCLE_NANO_AUTH_INVALID',
        message: result.invalidReason ?? 'Circle Nanopayment verification failed.',
      },
    }
  }

  appLogger.info('circle_nano.payment_validated', {
    toolSlug: toolConfig.slug,
    payer: result.payerAddress,
    amountBaseUnits: result.amountBaseUnits,
  })
  return {
    valid: true,
    payerAddress: result.payerAddress,
    amountUsdc: result.amountBaseUnits,
  }
}

/**
 * The CAIP-2 network the circle-nano rail advertises + settles on (Base mainnet).
 * Single source for the 402's network → keeps `pay_to`, `asset_address`, and the
 * `eip712_domain` mutually consistent (all derived from this one constant).
 */
const CIRCLE_NANO_402_NETWORK = 'eip155:8453'

export function generateCircleNano402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string,
): Response {
  // B1.1 — surface the payee + USDC token contract + EIP-712 domain so an external
  // payer can construct a valid authorization from the 402 alone. The asset +
  // domain come from the SAME pinned constants the verifier binds to (advertised
  // == verified by construction). Only advertise a payee that is actually a valid
  // address — the verifier fails closed on a set-but-invalid recipient, so we must
  // not advertise one (and when the recipient env is unset, circle-nano is dark
  // and the discovery fields are simply omitted).
  const network = CIRCLE_NANO_402_NETWORK
  const rawRecipient = getCircleNanoRecipient()
  const recipient =
    rawRecipient && isAddress(rawRecipient, { strict: false }) ? rawRecipient : undefined
  const domain = USDC_EIP712_DOMAINS[network]
  return generateCircleNano402ResponseCore({
    toolSlug,
    costCents,
    toolName,
    appUrl: getAppUrl(),
    network,
    recipient,
    assetAddress: USDC_ADDRESSES[network],
    assetDomain: domain
      ? { name: domain.name, version: domain.version, chainId: domain.chainId }
      : undefined,
  })
}

export { circleNanoAdapter }
export type { CircleNanoPaymentResult, CircleNanoToolConfig, CircleNanoErrorCode }
