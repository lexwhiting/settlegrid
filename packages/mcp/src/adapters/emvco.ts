/**
 * EMVCo Agent Payments Protocol Adapter
 *
 * EMVCo is defining the standard for agent-initiated card payments backed by
 * all major card networks (Visa, Mastercard, Amex, Discover, JCB, UnionPay).
 * Uses 3-D Secure + Payment Tokenisation. The spec is still in working-group
 * stage — detection + 402 responses are fully functional; validation is
 * structural (stub) pending EMVCo spec finalization.
 *
 * P2.K2 migrates the lib/emvco-proxy.ts logic into this adapter file.
 *
 * @see https://www.emvco.com/
 */

import { randomUUID } from 'crypto'
import type {
  AcceptEntry,
  BuildChallengeOptions,
} from '../402-builder'
import { resolveOperationCost } from '../config'
import type {
  AdapterLogger,
  PaymentContext,
  ProtocolAdapter,
  SettlementResult,
} from './types'
import { NOOP_LOGGER } from './types'

// ─── EMVCo Constants ────────────────────────────────────────────────────────

const EMVCO_PROTOCOL_VERSION = '0.1-draft'

/** EMVCo-specific HTTP headers */
const EMVCO_HEADERS = {
  AGENT_TOKEN: 'x-emvco-agent-token',
  THREEDS_REF: 'x-emvco-3ds-ref',
  NETWORK: 'x-emvco-network',
  PROTOCOL: 'x-settlegrid-protocol',
} as const

/** Supported card networks under the EMVCo umbrella. Exported so the lib
 * re-export can surface the list via the same public name `EMVCO_NETWORKS`. */
export const EMVCO_NETWORKS = [
  'visa',
  'mastercard',
  'amex',
  'discover',
  'jcb',
  'unionpay',
] as const

export type EmvcoNetwork = (typeof EMVCO_NETWORKS)[number]

/** Minimum agent token length for structural validation. */
const MIN_EMVCO_TOKEN_LENGTH = 16

// ─── Public types ──────────────────────────────────────────────────────────

export interface EmvcoPaymentResult {
  valid: boolean
  transactionRef?: string
  network?: string
  threeDsRef?: string
  tokenRef?: string
  error?: { code: EmvcoErrorCode; message: string }
}

export type EmvcoErrorCode =
  | 'EMVCO_NOT_CONFIGURED'
  | 'EMVCO_TOKEN_MISSING'
  | 'EMVCO_TOKEN_INVALID'
  | 'EMVCO_3DS_FAILED'
  | 'EMVCO_NETWORK_UNSUPPORTED'
  | 'EMVCO_SPEC_PENDING'

export interface EmvcoToolConfig {
  slug: string
  costCents: number
  displayName: string
}

export interface EmvcoValidateOptions {
  enabled: boolean
  toolConfig: EmvcoToolConfig
  logger?: AdapterLogger
}

export interface Emvco402Options {
  toolSlug: string
  costCents: number
  toolName?: string
  appUrl: string
}

// ─── Adapter class ─────────────────────────────────────────────────────────

export class EmvcoAdapter implements ProtocolAdapter {
  readonly name = 'emvco' as const
  readonly displayName = 'EMVCo Agent Payments'

  canHandle(request: Request): boolean {
    if (request.headers.get(EMVCO_HEADERS.AGENT_TOKEN)) return true
    if (request.headers.get(EMVCO_HEADERS.PROTOCOL) === 'emvco') return true
    return false
  }

  async extractPaymentContext(request: Request): Promise<PaymentContext> {
    const agentToken = request.headers.get(EMVCO_HEADERS.AGENT_TOKEN) ?? ''
    const network = request.headers.get(EMVCO_HEADERS.NETWORK)?.toLowerCase()
    const threeDsRef = request.headers.get(EMVCO_HEADERS.THREEDS_REF) ?? undefined

    return {
      protocol: 'emvco',
      identity: {
        // EMVCo agent tokens are card-network-bound payment tokens + 3DS
        // authentication — closest match in IdentityType is 'tap-token'
        // (the Visa TAP sibling concept). P2.K2 retains the existing
        // IdentityType union; a future pass may add 'emvco-token'.
        type: 'tap-token',
        value: agentToken || 'unknown',
        metadata: { network, threeDsRef },
      },
      operation: {
        service: 'emvco-service',
        method: 'payment',
      },
      payment: {
        type: 'card-token',
        proof: agentToken || undefined,
      },
      requestId: request.headers.get('x-request-id') ?? randomUUID(),
    }
  }

  formatResponse(result: SettlementResult, _request: Request): Response {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-SettleGrid-Operation-Id': result.operationId,
      'X-SettleGrid-Protocol': 'emvco',
    }

    return new Response(
      JSON.stringify({
        success: result.status === 'settled',
        operationId: result.operationId,
        costCents: result.costCents,
        receipt: result.receipt ?? null,
        metadata: {
          protocol: result.metadata.protocol,
          latencyMs: result.metadata.latencyMs,
          settlementType: result.metadata.settlementType,
        },
      }),
      { status: 200, headers },
    )
  }

  formatError(error: Error, request: Request): Response {
    const msg = error.message.toLowerCase()
    const isTokenError =
      msg.includes('token') || msg.includes('invalid') || msg.includes('short')
    const isNetworkError = msg.includes('network') || msg.includes('unsupported')

    let status: number
    let code: string
    if (isTokenError) {
      status = 401
      code = 'EMVCO_TOKEN_INVALID'
    } else if (isNetworkError) {
      status = 400
      code = 'EMVCO_NETWORK_UNSUPPORTED'
    } else {
      status = 500
      code = 'EMVCO_SPEC_PENDING'
    }

    return new Response(
      JSON.stringify({
        error: {
          code,
          message: error.message,
          protocol: 'emvco' as const,
          timestamp: new Date().toISOString(),
          requestId: request.headers.get('x-request-id') ?? null,
        },
      }),
      { status, headers: { 'Content-Type': 'application/json' } },
    )
  }

  buildChallenge(options: BuildChallengeOptions): AcceptEntry {
    const method = options.method ?? 'default'
    const rawCost = resolveOperationCost(options.pricing, method)
    const costCents = Number.isFinite(rawCost) && rawCost >= 0 ? Math.floor(rawCost) : 0
    return {
      scheme: 'emvco',
      provider: 'emvco',
      costCents,
      currency: 'USD',
      acceptedPayments: ['emvco-agent-token'],
      supportedNetworks: [...EMVCO_NETWORKS],
    }
  }

  /** P2.K2 — spec-aligned verify() method. */
  async verify(
    request: Request,
    options: EmvcoValidateOptions,
  ): Promise<EmvcoPaymentResult> {
    return validateEmvcoPayment(request, options)
  }

  /** P2.K2 — generate a full EMVCo 402 Payment Required response. */
  build402Response(options: Emvco402Options): Response {
    return generateEmvco402Response(options)
  }
}

// ─── Module-level validation ───────────────────────────────────────────────

export async function validateEmvcoPayment(
  request: Request,
  options: EmvcoValidateOptions,
): Promise<EmvcoPaymentResult> {
  const { enabled, toolConfig } = options
  const logger = options.logger ?? NOOP_LOGGER

  if (!enabled) {
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
        message:
          'No EMVCo agent token found in request. Provide x-emvco-agent-token header.',
      },
    }
  }

  if (agentToken.length < MIN_EMVCO_TOKEN_LENGTH) {
    return {
      valid: false,
      error: {
        code: 'EMVCO_TOKEN_INVALID',
        message: 'EMVCo agent token is too short. Ensure a valid EMVCo payment token.',
      },
    }
  }

  const networkHeader = request.headers.get(EMVCO_HEADERS.NETWORK)?.toLowerCase()
  const threeDsRef = request.headers.get(EMVCO_HEADERS.THREEDS_REF) ?? undefined

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
    const transactionRef = randomUUID()

    logger.info('emvco.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      tokenPrefix: agentToken.slice(0, 12) + '...',
      network: networkHeader ?? 'unspecified',
      threeDsRef,
      transactionRef,
      note: 'EMVCo validation is stub; spec not finalized.',
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
        message:
          err instanceof Error
            ? err.message
            : 'Unexpected error during EMVCo payment validation.',
      },
    }
  }
}

// ─── Module-level 402 generation ───────────────────────────────────────────

export function generateEmvco402Response(options: Emvco402Options): Response {
  const { toolSlug, costCents, toolName, appUrl } = options
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

  return new Response(JSON.stringify(body), { status: 402, headers })
}
