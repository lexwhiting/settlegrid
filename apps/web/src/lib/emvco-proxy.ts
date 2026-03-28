/**
 * EMVCo Agent Payments — Smart Proxy Integration (Stub)
 *
 * Handles EMVCo's card-based agent payment standard for SettleGrid tools.
 * EMVCo is defining the standard for agent-initiated card payments backed by
 * all major card networks (Visa, Mastercard, Amex, Discover, JCB, UnionPay).
 *
 * Uses 3-D Secure + Payment Tokenisation for agent-initiated card payments.
 * The specification is still in working group stage — detection and 402
 * responses are fully functional; validation is stub-marked.
 *
 * @see https://www.emvco.com/
 */

import { logger } from './logger'
import { getAppUrl } from './env'

// ─── EMVCo Constants ────────────────────────────────────────────────────────

const EMVCO_PROTOCOL_VERSION = '0.1-draft'

/** EMVCo-specific HTTP headers */
const EMVCO_HEADERS = {
  /** EMVCo agent payment token */
  AGENT_TOKEN: 'x-emvco-agent-token',
  /** EMVCo 3DS transaction reference */
  THREEDS_REF: 'x-emvco-3ds-ref',
  /** EMVCo payment network indicator (visa, mastercard, amex, etc.) */
  NETWORK: 'x-emvco-network',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

/** Supported card networks under the EMVCo umbrella */
const EMVCO_NETWORKS = [
  'visa',
  'mastercard',
  'amex',
  'discover',
  'jcb',
  'unionpay',
] as const

type EmvcoNetwork = (typeof EMVCO_NETWORKS)[number]

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EmvcoPaymentResult {
  valid: boolean
  /** EMVCo transaction reference */
  transactionRef?: string
  /** Card network used */
  network?: string
  /** 3-D Secure authentication reference */
  threeDsRef?: string
  /** Tokenized payment credential reference */
  tokenRef?: string
  /** Error details when validation fails */
  error?: {
    code: EmvcoErrorCode
    message: string
  }
}

export type EmvcoErrorCode =
  | 'EMVCO_NOT_CONFIGURED'
  | 'EMVCO_TOKEN_MISSING'
  | 'EMVCO_TOKEN_INVALID'
  | 'EMVCO_3DS_FAILED'
  | 'EMVCO_NETWORK_UNSUPPORTED'
  | 'EMVCO_SPEC_PENDING'

export interface EmvcoToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name */
  displayName: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains EMVCo Agent Payment headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-emvco-agent-token header
 *   2. x-settlegrid-protocol: emvco header
 */
export function isEmvcoRequest(request: Request): boolean {
  if (request.headers.get(EMVCO_HEADERS.AGENT_TOKEN)) return true
  if (request.headers.get(EMVCO_HEADERS.PROTOCOL) === 'emvco') return true

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isEmvcoEnabled(): boolean {
  return process.env.EMVCO_ENABLED === 'true'
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming EMVCo Agent Payment.
 *
 * TODO: Implement actual EMVCo specification validation when the working
 * group publishes the final spec. Expected flow:
 *   1. Extract the EMVCo payment token from headers
 *   2. Verify 3-D Secure authentication via EMVCo infrastructure
 *   3. Validate the payment tokenisation credential
 *   4. Process the card payment via the network acquirer
 *
 * Currently validates token structure and returns a stub-accepted result.
 */
export async function validateEmvcoPayment(
  request: Request,
  toolConfig: EmvcoToolConfig
): Promise<EmvcoPaymentResult> {
  if (!isEmvcoEnabled()) {
    return {
      valid: false,
      error: {
        code: 'EMVCO_NOT_CONFIGURED',
        message: 'EMVCo Agent Payments are not configured on this SettleGrid instance.',
      },
    }
  }

  const agentToken = request.headers.get(EMVCO_HEADERS.AGENT_TOKEN)
  if (!agentToken) {
    return {
      valid: false,
      error: {
        code: 'EMVCO_TOKEN_MISSING',
        message: 'No EMVCo agent token found in request. Provide x-emvco-agent-token header.',
      },
    }
  }

  // Validate token format (minimum length)
  if (agentToken.length < 16) {
    return {
      valid: false,
      error: {
        code: 'EMVCO_TOKEN_INVALID',
        message: 'EMVCo agent token is too short. Ensure a valid EMVCo payment token.',
      },
    }
  }

  // Extract optional network and 3DS reference
  const networkHeader = request.headers.get(EMVCO_HEADERS.NETWORK)?.toLowerCase()
  const threeDsRef = request.headers.get(EMVCO_HEADERS.THREEDS_REF) ?? undefined

  // Validate network if specified
  if (networkHeader && !EMVCO_NETWORKS.includes(networkHeader as EmvcoNetwork)) {
    return {
      valid: false,
      error: {
        code: 'EMVCO_NETWORK_UNSUPPORTED',
        message: `Unsupported card network: "${networkHeader}". Supported: ${EMVCO_NETWORKS.join(', ')}.`,
      },
    }
  }

  try {
    // TODO: EMVCo spec is not finalized — stub validation
    //
    // Expected implementation when spec is published:
    //   1. Decode the EMVCo payment token (DPAN + cryptogram)
    //   2. Verify 3-D Secure authentication result via Directory Server
    //   3. Submit to acquirer for authorization
    //   4. Capture the payment
    //
    // For now, accept structurally valid tokens.

    const transactionRef = crypto.randomUUID()

    logger.info('emvco.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      tokenPrefix: agentToken.slice(0, 12) + '...',
      network: networkHeader ?? 'unspecified',
      threeDsRef,
      transactionRef,
      note: 'EMVCo validation is stub; spec not finalized. Accepted based on structural validation.',
    })

    return {
      valid: true,
      transactionRef,
      network: networkHeader ?? undefined,
      threeDsRef,
      tokenRef: agentToken.slice(0, 8),
    }
  } catch (err) {
    logger.error('emvco.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'EMVCO_SPEC_PENDING',
        message: err instanceof Error ? err.message : 'Unexpected error during EMVCo payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an EMVCo Agent Payment 402 Payment Required response.
 */
export function generateEmvco402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  const body = {
    error: 'payment_required',
    protocol: 'emvco',
    version: EMVCO_PROTOCOL_VERSION,
    amount_cents: costCents,
    currency: 'usd',
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['emvco-agent-token'],
    supported_networks: [...EMVCO_NETWORKS],
    authentication: {
      type: '3d-secure',
      version: '2.3',
      agent_initiated: true,
    },
    tokenisation: {
      type: 'emvco-payment-token',
      supports_dpan: true,
      supports_cryptogram: true,
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain an EMVCo agent payment token via 3-D Secure authentication and re-send the request with x-emvco-agent-token header. Optionally include x-emvco-network (visa, mastercard, amex, discover, jcb, unionpay) and x-emvco-3ds-ref headers.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'emvco',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
