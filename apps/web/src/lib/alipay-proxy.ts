/**
 * ACTP — Alipay's Agentic Commerce Trust Protocol (Ant Group)
 *           — Smart Proxy Integration
 *
 * Handles Alipay's agentic commerce protocol for SettleGrid tools.
 * The canonical spec name is the "Agentic Commerce Trust Protocol" (ACTP);
 * earlier internal SettleGrid drafts called this "Alipay Trust Protocol"
 * — that shorthand is retired in favor of ACTP. Env var prefix and
 * filename still use `alipay-*` because that's the provider brand.
 *
 * Protocol mechanics use MCP + delegated authorization:
 *   - Agent presents Alipay authorization token
 *   - Service verifies via Alipay API
 *   - Payment processed through Alipay rails
 *
 * NOTE: Detection and 402 responses are fully functional. Validation
 * requires Alipay partnership credentials and is stub-marked with TODOs.
 * Status in the SettleGrid Smart Proxy: tracked as emerging rail pending
 * upstream ACTP spec maturity.
 *
 * @see https://global.alipay.com/
 */

import { logger } from './logger'
import { getAppUrl } from './env'

// ─── Alipay Constants ───────────────────────────────────────────────────────

const ALIPAY_PROTOCOL_VERSION = '1.0'

/** Alipay-specific HTTP headers */
const ALIPAY_HEADERS = {
  /** Alipay agent authorization token */
  AGENT_TOKEN: 'x-alipay-agent-token',
  /** Alipay agent session ID */
  SESSION_ID: 'x-alipay-session-id',
  /** Alipay merchant ID */
  MERCHANT_ID: 'x-alipay-merchant-id',
  /** SettleGrid protocol hint */
  PROTOCOL: 'x-settlegrid-protocol',
} as const

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AlipayPaymentResult {
  valid: boolean
  /** Alipay transaction reference */
  transactionRef?: string
  /** Alipay user/agent identifier */
  agentId?: string
  /** Amount in cents */
  amountCents?: number
  /** Alipay session ID */
  sessionId?: string
  /** Error details when validation fails */
  error?: {
    code: AlipayErrorCode
    message: string
  }
}

export type AlipayErrorCode =
  | 'ALIPAY_NOT_CONFIGURED'
  | 'ALIPAY_TOKEN_MISSING'
  | 'ALIPAY_TOKEN_INVALID'
  | 'ALIPAY_TOKEN_EXPIRED'
  | 'ALIPAY_INSUFFICIENT_FUNDS'
  | 'ALIPAY_API_ERROR'

export interface AlipayToolConfig {
  /** Tool slug */
  slug: string
  /** Cost in cents for this tool invocation */
  costCents: number
  /** Tool display name */
  displayName: string
}

// ─── Detection ──────────────────────────────────────────────────────────────

/**
 * Check if a request contains ACTP (Alipay Agentic Commerce Trust Protocol) headers.
 *
 * Detection criteria (any one is sufficient):
 *   1. x-alipay-agent-token header
 *   2. Authorization: Bearer alipay_* prefix
 *   3. x-settlegrid-protocol: alipay header
 */
export function isAlipayRequest(request: Request): boolean {
  if (request.headers.get(ALIPAY_HEADERS.AGENT_TOKEN)) return true
  if (request.headers.get(ALIPAY_HEADERS.PROTOCOL) === 'alipay') return true

  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('alipay_')) return true
  }

  return false
}

// ─── Env Check ──────────────────────────────────────────────────────────────

export function isAlipayEnabled(): boolean {
  return !!process.env.ALIPAY_APP_ID
}

// ─── Token Extraction ───────────────────────────────────────────────────────

/**
 * Extract the Alipay agent token from request headers.
 */
function extractAlipayToken(request: Request): string | null {
  // Priority 1: Explicit Alipay agent token header
  const agentToken = request.headers.get(ALIPAY_HEADERS.AGENT_TOKEN)
  if (agentToken) return agentToken

  // Priority 2: Authorization bearer with alipay_ prefix
  const auth = request.headers.get('authorization')
  if (auth) {
    const bearer = auth.replace(/^Bearer\s+/i, '')
    if (bearer.startsWith('alipay_')) return bearer
  }

  return null
}

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Validate an incoming ACTP (Alipay Agentic Commerce Trust Protocol) payment.
 *
 * TODO: Implement actual Alipay API verification. Requires:
 *   - ALIPAY_APP_ID: Alipay application ID
 *   - ALIPAY_PRIVATE_KEY: RSA private key for signing requests
 *   - Alipay Open Platform partnership agreement
 *
 * Current implementation validates token structure and returns
 * a stub-accepted result when the token format is valid.
 */
export async function validateAlipayPayment(
  request: Request,
  toolConfig: AlipayToolConfig
): Promise<AlipayPaymentResult> {
  if (!isAlipayEnabled()) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_NOT_CONFIGURED',
        message: 'ACTP (Alipay Agentic Commerce Trust Protocol) is not configured on this SettleGrid instance.',
      },
    }
  }

  const token = extractAlipayToken(request)
  if (!token) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_TOKEN_MISSING',
        message: 'No Alipay agent token found in request. Provide x-alipay-agent-token header or Authorization: Bearer alipay_* header.',
      },
    }
  }

  // Validate token format (minimum length and prefix)
  if (token.length < 16) {
    return {
      valid: false,
      error: {
        code: 'ALIPAY_TOKEN_INVALID',
        message: 'Alipay agent token is too short. Ensure a valid token from the Alipay Agent Authorization flow.',
      },
    }
  }

  const sessionId = request.headers.get(ALIPAY_HEADERS.SESSION_ID) ?? undefined

  try {
    // TODO: Call Alipay Open Platform API to verify the agent token
    //
    // Expected API call:
    //   POST https://openapi.alipay.com/gateway.do
    //   method: alipay.agent.token.verify
    //   app_id: ALIPAY_APP_ID
    //   sign_type: RSA2
    //   sign: <RSA signature of request params using ALIPAY_PRIVATE_KEY>
    //   biz_content: { agent_token: token, amount: costCents }
    //
    // Expected response:
    //   { transaction_id: "...", agent_id: "...", status: "SUCCESS" }

    const transactionRef = crypto.randomUUID()

    logger.info('alipay.payment_accepted_stub', {
      toolSlug: toolConfig.slug,
      tokenPrefix: token.slice(0, 12) + '...',
      sessionId,
      transactionRef,
      note: 'Alipay validation is stub; accepted based on structural validation. Requires Alipay partnership.',
    })

    return {
      valid: true,
      transactionRef,
      agentId: token.slice(0, 12),
      amountCents: toolConfig.costCents,
      sessionId,
    }
  } catch (err) {
    logger.error('alipay.validation_error', { toolSlug: toolConfig.slug }, err)
    return {
      valid: false,
      error: {
        code: 'ALIPAY_API_ERROR',
        message: err instanceof Error ? err.message : 'Unexpected error during Alipay payment validation.',
      },
    }
  }
}

// ─── 402 Response Generation ────────────────────────────────────────────────

/**
 * Generate an ACTP (Alipay Agentic Commerce Trust Protocol) 402 Payment Required response.
 */
export function generateAlipay402Response(
  toolSlug: string,
  costCents: number,
  toolName?: string
): Response {
  const appUrl = getAppUrl()
  const paymentEndpoint = `${appUrl}/api/proxy/${toolSlug}`
  const description = `${toolName ?? toolSlug} via SettleGrid`

  // Convert cents to CNY fen (1 cent USD ~ 7.2 CNY fen at approximate rate)
  const amountCnyFen = Math.ceil(costCents * 7.2)

  const body = {
    error: 'payment_required',
    protocol: 'alipay-trust',
    version: ALIPAY_PROTOCOL_VERSION,
    amount_cents: costCents,
    amount_cny_fen: amountCnyFen,
    currencies: ['USD', 'CNY'],
    description,
    tool: toolSlug,
    pricing_model: 'per-call',
    payment_endpoint: paymentEndpoint,
    accepted_payments: ['alipay-agent-token'],
    settlement: {
      type: 'alipay-rails',
      supported_methods: ['balance', 'credit', 'huabei'],
    },
    directory_url: `${appUrl}/api/v1/discover`,
    instructions: `To pay, obtain an Alipay Agent Token via the Alipay Agent Authorization flow and re-send the request with x-alipay-agent-token header or Authorization: Bearer alipay_<token>.`,
  }

  const headers = new Headers({
    'Content-Type': 'application/json',
    'X-SettleGrid-Protocol': 'alipay',
    'Cache-Control': 'no-store',
  })

  return new Response(JSON.stringify(body), {
    status: 402,
    headers,
  })
}
