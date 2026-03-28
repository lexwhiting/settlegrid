import { NextRequest, NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, apiKeys, consumerToolBalances, invocations } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { isIpInAllowlist } from '@/lib/ip-validation'
import { detectFraud, isIpBlocked, trackFailedAuth } from '@/lib/fraud'
import { isMppRequest, validateMppPayment, generateMpp402Response } from '@/lib/mpp'
import { isX402Request, validateX402Payment, generateX402_402Response } from '@/lib/x402-proxy'
import { isAp2Request, validateAp2Payment, generateAp2_402Response } from '@/lib/ap2-proxy'
import { isVisaTapRequest, validateVisaTapPayment, generateVisaTap402Response } from '@/lib/visa-tap-proxy'
import { isAcpRequest, validateAcpPayment, generateAcp402Response } from '@/lib/acp-proxy'
import { isUcpRequest, isUcpEnabled, validateUcpPayment, generateUcp402Response } from '@/lib/ucp-proxy'
import { isMastercardRequest, isMastercardEnabled, validateMastercardPayment, generateMastercard402Response } from '@/lib/mastercard-proxy'
import { isCircleNanoRequest, isCircleNanoEnabled, validateCircleNanoPayment, generateCircleNano402Response } from '@/lib/circle-nano-proxy'
import { isL402Request, isL402Enabled, validateL402Payment, generateL402_402Response } from '@/lib/l402-proxy'
import { isAlipayRequest, isAlipayEnabled, validateAlipayPayment, generateAlipay402Response } from '@/lib/alipay-proxy'
import { isKyaPayRequest, isKyaPayEnabled, validateKyaPayPayment, generateKyaPay402Response } from '@/lib/kyapay-proxy'
import { isEmvcoRequest, isEmvcoEnabled, validateEmvcoPayment, generateEmvco402Response } from '@/lib/emvco-proxy'
import { isDrainRequest, isDrainEnabled, validateDrainPayment, generateDrain402Response } from '@/lib/drain-proxy'
import {
  isMppEnabled,
  getMppRecipientId,
  isX402Enabled,
  isAp2Enabled,
  isVisaTapEnabled,
  isAcpEnabled,
} from '@/lib/env'

export const maxDuration = 60

const UPSTREAM_TIMEOUT_MS = 30_000

/**
 * Validates the x-api-key header and returns the key record with tool info.
 * Unlike requireApiKey from auth middleware, this does NOT restrict to a specific toolId —
 * we match by slug instead so the proxy works across tools.
 */
async function authenticateProxyRequest(
  request: NextRequest,
  toolSlug: string
): Promise<
  | {
      ok: true
      consumerId: string
      toolId: string
      keyId: string
      isTestKey: boolean
      ipAllowlist: string[] | null
      keyCreatedAt: Date | null
      keyLastUsedAt: Date | null
      tool: {
        id: string
        name: string
        slug: string
        proxyEndpoint: string
        developerId: string
        pricingConfig: unknown
      }
      developerRevenueSharePct: number
    }
  | { ok: false; error: NextResponse }
> {
  const rawKey = request.headers.get('x-api-key')

  if (!rawKey) {
    return {
      ok: false,
      error: errorResponse('API key required. Provide x-api-key header.', 401, 'API_KEY_REQUIRED'),
    }
  }

  if (rawKey.length < 16) {
    return {
      ok: false,
      error: errorResponse('Invalid API key format.', 401, 'INVALID_API_KEY'),
    }
  }

  const keyHash = hashApiKey(rawKey)

  // Look up the key, joining tool + developer to get all info in one query
  const results = await db
    .select({
      keyId: apiKeys.id,
      keyStatus: apiKeys.status,
      consumerId: apiKeys.consumerId,
      toolId: apiKeys.toolId,
      isTestKey: apiKeys.isTestKey,
      ipAllowlist: apiKeys.ipAllowlist,
      keyCreatedAt: apiKeys.createdAt,
      keyLastUsedAt: apiKeys.lastUsedAt,
      toolName: tools.name,
      toolSlug: tools.slug,
      toolStatus: tools.status,
      proxyEndpoint: tools.proxyEndpoint,
      developerId: tools.developerId,
      pricingConfig: tools.pricingConfig,
      revenueSharePct: developers.revenueSharePct,
    })
    .from(apiKeys)
    .innerJoin(tools, eq(apiKeys.toolId, tools.id))
    .innerJoin(developers, eq(tools.developerId, developers.id))
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1)

  if (results.length === 0) {
    return {
      ok: false,
      error: errorResponse('Invalid API key.', 401, 'INVALID_API_KEY'),
    }
  }

  const row = results[0]

  if (row.keyStatus !== 'active') {
    return {
      ok: false,
      error: errorResponse('API key has been revoked.', 401, 'API_KEY_REVOKED'),
    }
  }

  if (row.toolSlug !== toolSlug) {
    return {
      ok: false,
      error: errorResponse('API key does not match the requested tool.', 403, 'TOOL_MISMATCH'),
    }
  }

  if (row.toolStatus !== 'active') {
    return {
      ok: false,
      error: errorResponse('Tool is not active.', 404, 'TOOL_NOT_ACTIVE'),
    }
  }

  if (!row.proxyEndpoint) {
    return {
      ok: false,
      error: errorResponse(
        'This tool does not have a proxy endpoint configured. The developer must register an endpoint URL.',
        404,
        'NO_PROXY_ENDPOINT'
      ),
    }
  }

  // Update lastUsedAt in the background
  db.update(apiKeys)
    .set({ lastUsedAt: new Date() })
    .where(eq(apiKeys.id, row.keyId))
    .then(() => {})
    .catch(() => {})

  return {
    ok: true,
    consumerId: row.consumerId,
    toolId: row.toolId,
    keyId: row.keyId,
    isTestKey: row.isTestKey,
    ipAllowlist: row.ipAllowlist as string[] | null,
    keyCreatedAt: row.keyCreatedAt,
    keyLastUsedAt: row.keyLastUsedAt,
    tool: {
      id: row.toolId,
      name: row.toolName,
      slug: row.toolSlug,
      proxyEndpoint: row.proxyEndpoint,
      developerId: row.developerId,
      pricingConfig: row.pricingConfig,
    },
    developerRevenueSharePct: row.revenueSharePct,
  }
}

/**
 * Extracts the cost in cents for this invocation from the tool's pricing config.
 * Defaults to the `defaultCostCents` value for per-invocation pricing.
 */
function getCostCents(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') {
    return 0
  }

  const config = pricingConfig as Record<string, unknown>
  const defaultCost = config.defaultCostCents

  if (typeof defaultCost === 'number' && Number.isFinite(defaultCost) && defaultCost >= 0) {
    return Math.floor(defaultCost)
  }

  return 0
}

/**
 * Builds the set of headers to forward to the upstream tool.
 * Uses a WHITELIST approach to prevent open-relay and header injection attacks.
 */
function buildUpstreamHeaders(request: NextRequest): Headers {
  const headers = new Headers()

  // Whitelist: only forward safe, standard headers
  const ALLOWED_HEADERS = new Set([
    'content-type',
    'accept',
    'accept-language',
    'accept-encoding',
    'content-length',
    'user-agent',
    'x-request-id',
  ])

  request.headers.forEach((value, key) => {
    if (ALLOWED_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value)
    }
  })

  // Mark this request as coming through SettleGrid proxy
  headers.set('X-SettleGrid-Proxy', 'true')

  return headers
}

/**
 * Core proxy handler — shared between GET and POST.
 */
async function handleProxy(
  request: NextRequest,
  slug: string
): Promise<NextResponse> {
  const requestId = getOrCreateRequestId(request)
  const startTime = Date.now()

  try {
    // Rate limit by IP
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rateLimit = await checkRateLimit(sdkLimiter, `proxy:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    // ── Payment Protocol Detection Chain ────────────────────────────────────
    // Check each payment protocol in priority order. When a protocol is
    // enabled and the request matches its headers, use that protocol's
    // payment flow instead of the standard API key flow.

    // 1. MPP (Stripe Machine Payments Protocol)
    if (isMppEnabled() && isMppRequest(request)) {
      return handleMppProxy(request, slug, requestId, startTime)
    }

    // 2. x402 (Coinbase — USDC on Base blockchain)
    if (isX402Enabled() && isX402Request(request)) {
      return handleX402Proxy(request, slug, requestId, startTime)
    }

    // 3. AP2 (Google Agentic Payments Protocol)
    if (isAp2Enabled() && isAp2Request(request)) {
      return handleAp2Proxy(request, slug, requestId, startTime)
    }

    // 4. Visa TAP (Trusted Agent Protocol)
    if (isVisaTapEnabled() && isVisaTapRequest(request)) {
      return handleVisaTapProxy(request, slug, requestId, startTime)
    }

    // 5. ACP (Agentic Commerce Protocol — Stripe + OpenAI)
    if (isAcpEnabled() && isAcpRequest(request)) {
      return handleAcpProxy(request, slug, requestId, startTime)
    }

    // 6. UCP (Universal Commerce Protocol)
    if (isUcpEnabled() && isUcpRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'ucp')
    }

    // 7. Mastercard Agent Pay
    if (isMastercardEnabled() && isMastercardRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'mastercard-vi')
    }

    // 8. Circle Nanopayments
    if (isCircleNanoEnabled() && isCircleNanoRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'circle-nano')
    }

    // 9. L402 (Bitcoin Lightning)
    if (isL402Enabled() && isL402Request(request)) {
      return handleL402Proxy(request, slug, requestId, startTime)
    }

    // 10. Alipay Trust Protocol
    if (isAlipayEnabled() && isAlipayRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'alipay')
    }

    // 11. KYAPay (Visa Intelligent Commerce)
    if (isKyaPayEnabled() && isKyaPayRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'kyapay')
    }

    // 12. EMVCo Agent Payments
    if (isEmvcoEnabled() && isEmvcoRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'emvco')
    }

    // 13. DRAIN (Off-chain USDC)
    if (isDrainEnabled() && isDrainRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'drain')
    }

    // ── Standard API Key Flow ───────────────────────────────────────────────

    // Check if caller IP is blocked due to excessive failed auth attempts
    const blocked = await isIpBlocked(ip)
    if (blocked) {
      return errorResponse('Too many failed attempts. Try again later.', 429, 'IP_BLOCKED', requestId)
    }

    // Authenticate
    const auth = await authenticateProxyRequest(request, slug)
    if (!auth.ok) {
      // Track failed auth for IP-based blocking
      trackFailedAuth(ip).catch(() => {})
      return auth.error
    }

    // ── IP Allowlist Enforcement ──────────────────────────────────────────
    const allowlist = auth.ipAllowlist
    if (allowlist && allowlist.length > 0) {
      if (!isIpInAllowlist(ip, allowlist)) {
        logger.warn('proxy.ip_not_in_allowlist', {
          slug,
          consumerId: auth.consumerId,
          ip,
          requestId,
        })
        return errorResponse(
          'Request from unauthorized IP address.',
          403,
          'IP_NOT_ALLOWED',
          requestId
        )
      }
    }

    const costCents = getCostCents(auth.tool.pricingConfig)

    // ── Fraud Detection ──────────────────────────────────────────────────
    // Run fraud detection in parallel with balance checks (non-blocking for
    // low-risk calls, blocking for high-risk).
    const fraudResult = await detectFraud({
      consumerId: auth.consumerId,
      toolId: auth.toolId,
      costCents,
      ip,
      keyId: auth.keyId,
      keyCreatedAt: auth.keyCreatedAt ?? undefined,
      keyLastUsedAt: auth.keyLastUsedAt,
      method: `proxy:${request.method}`,
    })

    if (fraudResult.flagged) {
      logger.warn('proxy.fraud_flagged', {
        slug,
        consumerId: auth.consumerId,
        riskScore: fraudResult.riskScore,
        signals: fraudResult.signals,
        reasons: fraudResult.reasons,
        requestId,
      })
    }

    // For test keys, skip balance checks but still proxy
    if (!auth.isTestKey && costCents > 0) {
      // Check consumer balance
      const [balance] = await db
        .select({
          id: consumerToolBalances.id,
          balanceCents: consumerToolBalances.balanceCents,
        })
        .from(consumerToolBalances)
        .where(
          and(
            eq(consumerToolBalances.consumerId, auth.consumerId),
            eq(consumerToolBalances.toolId, auth.toolId)
          )
        )
        .limit(1)

      if (!balance || balance.balanceCents < costCents) {
        const currentBalance = balance?.balanceCents ?? 0
        return errorResponse(
          `Insufficient balance. Required: ${costCents} cents, available: ${currentBalance} cents.`,
          402,
          'INSUFFICIENT_BALANCE',
          requestId,
          { requiredCents: costCents, availableCents: currentBalance }
        )
      }
    }

    // Forward request to upstream tool
    const upstreamHeaders = buildUpstreamHeaders(request)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    let upstreamResponse: Response
    try {
      const fetchInit: RequestInit = {
        method: request.method,
        headers: upstreamHeaders,
        signal: controller.signal,
      }

      // Forward body for methods that support it
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        fetchInit.body = request.body
        // Enable streaming of request body
        // @ts-expect-error -- duplex is required for streaming request bodies in fetch but not in the TS types yet
        fetchInit.duplex = 'half'
      }

      upstreamResponse = await fetch(auth.tool.proxyEndpoint, fetchInit)
    } catch (err) {
      clearTimeout(timeout)
      const latencyMs = Date.now() - startTime

      logger.error('proxy.upstream_error', {
        slug,
        consumerId: auth.consumerId,
        latencyMs,
        error: err instanceof Error ? err.message : String(err),
        requestId,
      })

      // Record failed invocation (don't charge)
      db.insert(invocations)
        .values({
          toolId: auth.toolId,
          consumerId: auth.consumerId,
          apiKeyId: auth.keyId,
          method: `proxy:${request.method}`,
          costCents: 0,
          latencyMs,
          status: 'error',
          isTest: auth.isTestKey,
          isFlagged: fraudResult.flagged,
          metadata: { error: err instanceof Error ? err.name : 'unknown', proxy: true },
        })
        .then(() => {})
        .catch(() => {})

      if (err instanceof Error && err.name === 'AbortError') {
        return errorResponse(
          'Upstream tool timed out after 30 seconds.',
          504,
          'UPSTREAM_TIMEOUT',
          requestId
        )
      }

      return errorResponse(
        'Upstream tool is unreachable.',
        503,
        'UPSTREAM_UNREACHABLE',
        requestId
      )
    } finally {
      clearTimeout(timeout)
    }

    const latencyMs = Date.now() - startTime
    const upstreamStatus = upstreamResponse.status
    const upstreamOk = upstreamStatus >= 200 && upstreamStatus < 300

    // Only charge if upstream returned success
    const actualCost = upstreamOk && !auth.isTestKey ? costCents : 0

    if (actualCost > 0) {
      // Atomic balance deduction
      const [updatedBalance] = await db
        .update(consumerToolBalances)
        .set({
          balanceCents: sql`${consumerToolBalances.balanceCents} - ${actualCost}`,
          currentPeriodSpendCents: sql`${consumerToolBalances.currentPeriodSpendCents} + ${actualCost}`,
        })
        .where(
          and(
            eq(consumerToolBalances.consumerId, auth.consumerId),
            eq(consumerToolBalances.toolId, auth.toolId),
            sql`${consumerToolBalances.balanceCents} >= ${actualCost}`
          )
        )
        .returning({ balanceCents: consumerToolBalances.balanceCents })

      if (!updatedBalance) {
        // Race condition — balance was spent between check and deduct. Don't charge.
        logger.warn('proxy.balance_race_condition', {
          slug,
          consumerId: auth.consumerId,
          costCents: actualCost,
          requestId,
        })
      } else {
        // Increment tool revenue + developer balance
        const developerShareCents = Math.floor(actualCost * (auth.developerRevenueSharePct / 100))

        // Fire-and-forget: update tool stats + developer balance
        Promise.all([
          db
            .update(tools)
            .set({
              totalInvocations: sql`${tools.totalInvocations} + 1`,
              totalRevenueCents: sql`${tools.totalRevenueCents} + ${actualCost}`,
              updatedAt: new Date(),
            })
            .where(eq(tools.id, auth.toolId)),
          db
            .update(developers)
            .set({
              balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
              updatedAt: new Date(),
            })
            .where(eq(developers.id, auth.tool.developerId)),
        ]).catch((err) => {
          logger.error('proxy.billing_update_error', { slug, requestId }, err)
        })
      }
    } else if (upstreamOk) {
      // Free tool or test key — still increment invocation count
      db.update(tools)
        .set({
          totalInvocations: sql`${tools.totalInvocations} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, auth.toolId))
        .then(() => {})
        .catch(() => {})
    }

    // Record invocation (with fraud flag and test mode metadata)
    db.insert(invocations)
      .values({
        toolId: auth.toolId,
        consumerId: auth.consumerId,
        apiKeyId: auth.keyId,
        method: `proxy:${request.method}`,
        costCents: actualCost,
        latencyMs,
        status: upstreamOk ? 'success' : 'error',
        isTest: auth.isTestKey,
        isFlagged: fraudResult.flagged,
        metadata: {
          proxy: true,
          upstreamStatus,
          toolSlug: slug,
          ...(auth.isTestKey ? { isTest: true } : {}),
          ...(fraudResult.flagged ? { fraudRiskScore: fraudResult.riskScore, fraudSignals: fraudResult.signals } : {}),
        },
      })
      .then(() => {})
      .catch(() => {})

    // Log the proxy call
    logger.info('proxy.invocation', {
      slug,
      consumerId: auth.consumerId,
      latencyMs,
      upstreamStatus,
      costCents: actualCost,
      isTest: auth.isTestKey,
      isFlagged: fraudResult.flagged,
      requestId,
    })

    // Stream the upstream response back to the caller
    const responseHeaders = new Headers()

    // Forward upstream response headers
    upstreamResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      // Skip hop-by-hop headers
      if (lower !== 'transfer-encoding' && lower !== 'connection') {
        responseHeaders.set(key, value)
      }
    })

    // Add SettleGrid proxy headers
    responseHeaders.set('X-SettleGrid-Proxy', 'true')
    responseHeaders.set('X-SettleGrid-Cost-Cents', String(actualCost))
    responseHeaders.set('X-SettleGrid-Latency-Ms', String(latencyMs))
    responseHeaders.set('X-Powered-By', 'SettleGrid (settlegrid.ai)')
    responseHeaders.set('X-SettleGrid-Tool', slug)
    responseHeaders.set('X-SettleGrid-Protocol', 'api-key')
    if (auth.isTestKey) {
      responseHeaders.set('X-SettleGrid-Mode', 'sandbox')
    }
    if (requestId) {
      responseHeaders.set('x-request-id', requestId)
    }

    // Inject _settlegrid metadata into JSON responses
    return injectAttributionAndReturn(upstreamResponse, responseHeaders, upstreamStatus, slug, actualCost, 'api-key')
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error('proxy.internal_error', { slug, latencyMs, requestId }, error)
    return internalErrorResponse(error, requestId)
  }
}

/**
 * Injects `_settlegrid` metadata into JSON responses for attribution.
 * For non-JSON responses, streams the body through unchanged.
 */
async function injectAttributionAndReturn(
  upstreamResponse: Response,
  responseHeaders: Headers,
  upstreamStatus: number,
  toolSlug: string,
  costCents: number,
  protocol: string
): Promise<NextResponse> {
  const contentType = upstreamResponse.headers.get('content-type') ?? ''
  const isJson = contentType.includes('application/json')

  if (!isJson) {
    return new NextResponse(upstreamResponse.body, {
      status: upstreamStatus,
      headers: responseHeaders,
    })
  }

  // Parse and inject _settlegrid metadata
  try {
    const text = await upstreamResponse.text()
    const parsed = JSON.parse(text)

    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsed._settlegrid = {
        tool: toolSlug,
        cost: costCents < 100 ? `$0.${String(costCents).padStart(2, '0')}` : `$${(costCents / 100).toFixed(2)}`,
        protocol,
        poweredBy: 'settlegrid.ai',
      }
    }

    return new NextResponse(JSON.stringify(parsed), {
      status: upstreamStatus,
      headers: responseHeaders,
    })
  } catch {
    // If JSON parsing fails, return the raw body through
    return new NextResponse(upstreamResponse.body, {
      status: upstreamStatus,
      headers: responseHeaders,
    })
  }
}

/**
 * MPP-specific proxy handler.
 *
 * Flow:
 *   1. Look up the tool by slug (no API key required)
 *   2. Validate the MPP payment token via Stripe
 *   3. If invalid: return MPP 402 with pricing info
 *   4. If valid: forward request to upstream, record invocation with paymentMethod: 'mpp'
 */
async function handleMppProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  // Look up the tool by slug (no API key or consumer auth required for MPP)
  const [toolRow] = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      status: tools.status,
      proxyEndpoint: tools.proxyEndpoint,
      developerId: tools.developerId,
      pricingConfig: tools.pricingConfig,
      revenueSharePct: developers.revenueSharePct,
    })
    .from(tools)
    .innerJoin(developers, eq(tools.developerId, developers.id))
    .where(eq(tools.slug, slug))
    .limit(1)

  if (!toolRow) {
    return errorResponse('Tool not found.', 404, 'TOOL_NOT_FOUND', requestId)
  }

  if (toolRow.status !== 'active') {
    return errorResponse('Tool is not active.', 404, 'TOOL_NOT_ACTIVE', requestId)
  }

  if (!toolRow.proxyEndpoint) {
    return errorResponse(
      'This tool does not have a proxy endpoint configured.',
      404,
      'NO_PROXY_ENDPOINT',
      requestId
    )
  }

  const costCents = getCostCents(toolRow.pricingConfig)

  // Validate the MPP payment
  const mppResult = await validateMppPayment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    recipientId: getMppRecipientId(),
  })

  if (!mppResult.valid) {
    // If the token was simply missing or MPP not configured, return a proper 402
    // with pricing info so the agent can negotiate payment.
    logger.info('proxy.mpp_payment_required', {
      slug,
      costCents,
      errorCode: mppResult.error?.code,
      requestId,
    })

    const mpp402 = generateMpp402Response(
      toolRow.slug,
      costCents,
      toolRow.name,
      getMppRecipientId()
    )

    // Convert to NextResponse to attach request ID
    const body = await mpp402.text()
    const headers = new Headers(mpp402.headers)
    if (requestId) headers.set('x-request-id', requestId)

    return new NextResponse(body, {
      status: 402,
      headers,
    })
  }

  // MPP payment is valid — forward the request to upstream
  const upstreamHeaders = buildUpstreamHeaders(request)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let upstreamResponse: Response
  try {
    const fetchInit: RequestInit = {
      method: request.method,
      headers: upstreamHeaders,
      signal: controller.signal,
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchInit.body = request.body
      // @ts-expect-error -- duplex is required for streaming request bodies in fetch but not in the TS types yet
      fetchInit.duplex = 'half'
    }

    upstreamResponse = await fetch(toolRow.proxyEndpoint, fetchInit)
  } catch (err) {
    clearTimeout(timeout)
    const latencyMs = Date.now() - startTime

    logger.error('proxy.mpp_upstream_error', {
      slug,
      mppPaymentId: mppResult.paymentId,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
      requestId,
    })

    // Record failed invocation (MPP payment was captured but upstream failed)
    recordMppInvocation({
      toolId: toolRow.id,
      developerId: toolRow.developerId,
      method: `proxy:${request.method}`,
      costCents: 0,
      latencyMs,
      status: 'error',
      mppPaymentId: mppResult.paymentId,
      mppPayerCustomerId: mppResult.payerCustomerId,
      mppSessionId: mppResult.sessionId,
      toolSlug: slug,
    })

    if (err instanceof Error && err.name === 'AbortError') {
      return errorResponse(
        'Upstream tool timed out after 30 seconds.',
        504,
        'UPSTREAM_TIMEOUT',
        requestId
      )
    }

    return errorResponse(
      'Upstream tool is unreachable.',
      503,
      'UPSTREAM_UNREACHABLE',
      requestId
    )
  } finally {
    clearTimeout(timeout)
  }

  const latencyMs = Date.now() - startTime
  const upstreamStatus = upstreamResponse.status
  const upstreamOk = upstreamStatus >= 200 && upstreamStatus < 300

  // For MPP: payment was already captured by Stripe during validation.
  // Record the invocation and update tool stats.
  const actualCost = upstreamOk ? costCents : 0

  if (upstreamOk) {
    // Increment tool revenue + developer balance
    const developerShareCents = Math.floor(actualCost * (toolRow.revenueSharePct / 100))

    Promise.all([
      db
        .update(tools)
        .set({
          totalInvocations: sql`${tools.totalInvocations} + 1`,
          totalRevenueCents: sql`${tools.totalRevenueCents} + ${actualCost}`,
          updatedAt: new Date(),
        })
        .where(eq(tools.id, toolRow.id)),
      db
        .update(developers)
        .set({
          balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
          updatedAt: new Date(),
        })
        .where(eq(developers.id, toolRow.developerId)),
    ]).catch((err) => {
      logger.error('proxy.mpp_billing_update_error', { slug, requestId }, err)
    })
  }

  // Record the MPP invocation
  recordMppInvocation({
    toolId: toolRow.id,
    developerId: toolRow.developerId,
    method: `proxy:${request.method}`,
    costCents: actualCost,
    latencyMs,
    status: upstreamOk ? 'success' : 'error',
    mppPaymentId: mppResult.paymentId,
    mppPayerCustomerId: mppResult.payerCustomerId,
    mppSessionId: mppResult.sessionId,
    toolSlug: slug,
    upstreamStatus,
  })

  logger.info('proxy.mpp_invocation', {
    slug,
    mppPaymentId: mppResult.paymentId,
    latencyMs,
    upstreamStatus,
    costCents: actualCost,
    requestId,
  })

  // Stream the upstream response back
  const responseHeaders = new Headers()
  upstreamResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower !== 'transfer-encoding' && lower !== 'connection') {
      responseHeaders.set(key, value)
    }
  })

  responseHeaders.set('X-SettleGrid-Proxy', 'true')
  responseHeaders.set('X-SettleGrid-Cost-Cents', String(actualCost))
  responseHeaders.set('X-SettleGrid-Latency-Ms', String(latencyMs))
  responseHeaders.set('X-SettleGrid-Payment-Method', 'mpp')
  responseHeaders.set('X-Powered-By', 'SettleGrid (settlegrid.ai)')
  responseHeaders.set('X-SettleGrid-Tool', slug)
  responseHeaders.set('X-SettleGrid-Protocol', 'mpp')
  if (mppResult.paymentId) {
    responseHeaders.set('X-SettleGrid-MPP-Payment-Id', mppResult.paymentId)
  }
  if (requestId) {
    responseHeaders.set('x-request-id', requestId)
  }

  return injectAttributionAndReturn(upstreamResponse, responseHeaders, upstreamStatus, slug, actualCost, 'mpp')
}

/**
 * Record an MPP-paid invocation to the database.
 * Uses a placeholder consumer/apiKey since MPP payments bypass the
 * traditional API key flow. The MPP payment details are stored in metadata.
 */
function recordMppInvocation(params: {
  toolId: string
  developerId: string
  method: string
  costCents: number
  latencyMs: number
  status: 'success' | 'error'
  mppPaymentId?: string
  mppPayerCustomerId?: string
  mppSessionId?: string
  toolSlug: string
  upstreamStatus?: number
}): void {
  // MPP invocations use a sentinel consumer/key ID since there is no
  // SettleGrid consumer account — the payer is identified by their Stripe customer ID.
  // The MPP_SENTINEL_ID is a fixed UUID that represents "MPP direct payment".
  const MPP_SENTINEL_ID = '00000000-0000-0000-0000-000000000001'

  db.insert(invocations)
    .values({
      toolId: params.toolId,
      consumerId: MPP_SENTINEL_ID,
      apiKeyId: MPP_SENTINEL_ID,
      method: params.method,
      costCents: params.costCents,
      latencyMs: params.latencyMs,
      status: params.status,
      isTest: false,
      metadata: {
        proxy: true,
        paymentMethod: 'mpp',
        mppPaymentId: params.mppPaymentId ?? null,
        mppPayerCustomerId: params.mppPayerCustomerId ?? null,
        mppSessionId: params.mppSessionId ?? null,
        toolSlug: params.toolSlug,
        upstreamStatus: params.upstreamStatus ?? null,
      },
    })
    .then(() => {})
    .catch((err) => {
      logger.error('proxy.mpp_invocation_record_error', {
        toolId: params.toolId,
        mppPaymentId: params.mppPaymentId,
      }, err)
    })
}

// ─── Shared: Look up tool by slug (no API key required) ─────────────────────

type PaymentMethod = 'mpp' | 'x402' | 'ap2' | 'visa-tap' | 'acp' | 'ucp' | 'mastercard-vi' | 'circle-nano' | 'l402' | 'alipay' | 'kyapay' | 'emvco' | 'drain'

async function lookupToolBySlug(slug: string, requestId: string) {
  const [toolRow] = await db
    .select({
      id: tools.id,
      name: tools.name,
      slug: tools.slug,
      status: tools.status,
      proxyEndpoint: tools.proxyEndpoint,
      developerId: tools.developerId,
      pricingConfig: tools.pricingConfig,
      revenueSharePct: developers.revenueSharePct,
    })
    .from(tools)
    .innerJoin(developers, eq(tools.developerId, developers.id))
    .where(eq(tools.slug, slug))
    .limit(1)

  if (!toolRow) {
    return { ok: false as const, error: errorResponse('Tool not found.', 404, 'TOOL_NOT_FOUND', requestId) }
  }
  if (toolRow.status !== 'active') {
    return { ok: false as const, error: errorResponse('Tool is not active.', 404, 'TOOL_NOT_ACTIVE', requestId) }
  }
  if (!toolRow.proxyEndpoint) {
    return { ok: false as const, error: errorResponse('This tool does not have a proxy endpoint configured.', 404, 'NO_PROXY_ENDPOINT', requestId) }
  }
  // After the null check above, proxyEndpoint is guaranteed to be a string.
  // Use an intermediate variable to help TypeScript narrow the type.
  const verifiedTool = {
    id: toolRow.id,
    name: toolRow.name,
    slug: toolRow.slug,
    proxyEndpoint: toolRow.proxyEndpoint as string,
    developerId: toolRow.developerId,
    pricingConfig: toolRow.pricingConfig,
    revenueSharePct: toolRow.revenueSharePct,
  }
  return { ok: true as const, toolRow: verifiedTool }
}

/**
 * Record a protocol-paid invocation to the database.
 * Uses a sentinel consumer/apiKey since protocol payments bypass the
 * traditional API key flow. Payment details are stored in metadata.
 */
function recordProtocolInvocation(params: {
  toolId: string
  developerId: string
  method: string
  costCents: number
  latencyMs: number
  status: 'success' | 'error'
  paymentMethod: PaymentMethod
  paymentId?: string
  payerIdentifier?: string
  toolSlug: string
  upstreamStatus?: number
  extraMetadata?: Record<string, unknown>
}): void {
  // Protocol invocations use a sentinel consumer/key ID — the payer is identified
  // by their protocol-specific identifier, not a SettleGrid consumer account.
  const PROTOCOL_SENTINEL_ID = '00000000-0000-0000-0000-000000000002'

  db.insert(invocations)
    .values({
      toolId: params.toolId,
      consumerId: PROTOCOL_SENTINEL_ID,
      apiKeyId: PROTOCOL_SENTINEL_ID,
      method: params.method,
      costCents: params.costCents,
      latencyMs: params.latencyMs,
      status: params.status,
      isTest: false,
      metadata: {
        proxy: true,
        paymentMethod: params.paymentMethod,
        paymentId: params.paymentId ?? null,
        payerIdentifier: params.payerIdentifier ?? null,
        toolSlug: params.toolSlug,
        upstreamStatus: params.upstreamStatus ?? null,
        ...params.extraMetadata,
      },
    })
    .then(() => {})
    .catch((err) => {
      logger.error('proxy.protocol_invocation_record_error', {
        toolId: params.toolId,
        paymentMethod: params.paymentMethod,
        paymentId: params.paymentId,
      }, err)
    })
}

/**
 * Forward a request to the upstream tool and handle billing.
 * Shared by all protocol handlers after payment validation succeeds.
 */
async function forwardAndBill(
  request: NextRequest,
  toolRow: {
    id: string
    name: string
    slug: string
    proxyEndpoint: string
    developerId: string
    pricingConfig: unknown
    revenueSharePct: number
  },
  paymentMethod: PaymentMethod,
  costCents: number,
  slug: string,
  requestId: string,
  startTime: number,
  paymentId: string | undefined,
  payerIdentifier: string | undefined,
  extraHeaders: Record<string, string>,
  extraMetadata?: Record<string, unknown>
): Promise<NextResponse> {
  const upstreamHeaders = buildUpstreamHeaders(request)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

  let upstreamResponse: Response
  try {
    const fetchInit: RequestInit = {
      method: request.method,
      headers: upstreamHeaders,
      signal: controller.signal,
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      fetchInit.body = request.body
      // @ts-expect-error -- duplex is required for streaming request bodies in fetch but not in the TS types yet
      fetchInit.duplex = 'half'
    }

    upstreamResponse = await fetch(toolRow.proxyEndpoint, fetchInit)
  } catch (err) {
    clearTimeout(timeout)
    const latencyMs = Date.now() - startTime

    logger.error(`proxy.${paymentMethod}_upstream_error`, {
      slug,
      paymentId,
      latencyMs,
      error: err instanceof Error ? err.message : String(err),
      requestId,
    })

    recordProtocolInvocation({
      toolId: toolRow.id,
      developerId: toolRow.developerId,
      method: `proxy:${request.method}`,
      costCents: 0,
      latencyMs,
      status: 'error',
      paymentMethod,
      paymentId,
      payerIdentifier,
      toolSlug: slug,
      extraMetadata,
    })

    if (err instanceof Error && err.name === 'AbortError') {
      return errorResponse('Upstream tool timed out after 30 seconds.', 504, 'UPSTREAM_TIMEOUT', requestId)
    }
    return errorResponse('Upstream tool is unreachable.', 503, 'UPSTREAM_UNREACHABLE', requestId)
  } finally {
    clearTimeout(timeout)
  }

  const latencyMs = Date.now() - startTime
  const upstreamStatus = upstreamResponse.status
  const upstreamOk = upstreamStatus >= 200 && upstreamStatus < 300
  const actualCost = upstreamOk ? costCents : 0

  if (upstreamOk) {
    const developerShareCents = Math.floor(actualCost * (toolRow.revenueSharePct / 100))

    Promise.all([
      db.update(tools).set({
        totalInvocations: sql`${tools.totalInvocations} + 1`,
        totalRevenueCents: sql`${tools.totalRevenueCents} + ${actualCost}`,
        updatedAt: new Date(),
      }).where(eq(tools.id, toolRow.id)),
      db.update(developers).set({
        balanceCents: sql`${developers.balanceCents} + ${developerShareCents}`,
        updatedAt: new Date(),
      }).where(eq(developers.id, toolRow.developerId)),
    ]).catch((err) => {
      logger.error(`proxy.${paymentMethod}_billing_update_error`, { slug, requestId }, err)
    })
  }

  recordProtocolInvocation({
    toolId: toolRow.id,
    developerId: toolRow.developerId,
    method: `proxy:${request.method}`,
    costCents: actualCost,
    latencyMs,
    status: upstreamOk ? 'success' : 'error',
    paymentMethod,
    paymentId,
    payerIdentifier,
    toolSlug: slug,
    upstreamStatus,
    extraMetadata,
  })

  logger.info(`proxy.${paymentMethod}_invocation`, {
    slug,
    paymentId,
    latencyMs,
    upstreamStatus,
    costCents: actualCost,
    requestId,
  })

  // Stream the upstream response back
  const responseHeaders = new Headers()
  upstreamResponse.headers.forEach((value, key) => {
    const lower = key.toLowerCase()
    if (lower !== 'transfer-encoding' && lower !== 'connection') {
      responseHeaders.set(key, value)
    }
  })

  responseHeaders.set('X-SettleGrid-Proxy', 'true')
  responseHeaders.set('X-SettleGrid-Cost-Cents', String(actualCost))
  responseHeaders.set('X-SettleGrid-Latency-Ms', String(latencyMs))
  responseHeaders.set('X-SettleGrid-Payment-Method', paymentMethod)
  responseHeaders.set('X-Powered-By', 'SettleGrid (settlegrid.ai)')
  responseHeaders.set('X-SettleGrid-Tool', slug)
  responseHeaders.set('X-SettleGrid-Protocol', paymentMethod)
  for (const [key, value] of Object.entries(extraHeaders)) {
    responseHeaders.set(key, value)
  }
  if (requestId) {
    responseHeaders.set('x-request-id', requestId)
  }

  return injectAttributionAndReturn(upstreamResponse, responseHeaders, upstreamStatus, slug, actualCost, paymentMethod)
}

// ─── x402 Proxy Handler ─────────────────────────────────────────────────────

async function handleX402Proxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)

  const x402Result = await validateX402Payment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    recipientAddress: process.env.SETTLEGRID_PAYMENT_ADDRESS,
  })

  if (!x402Result.valid) {
    logger.info('proxy.x402_payment_required', {
      slug,
      costCents,
      errorCode: x402Result.error?.code,
      requestId,
    })

    const x402Response = generateX402_402Response(toolRow.slug, costCents, toolRow.name)
    const body = await x402Response.text()
    const headers = new Headers(x402Response.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  return forwardAndBill(
    request, toolRow, 'x402', costCents, slug, requestId, startTime,
    x402Result.txHash,
    x402Result.payerAddress,
    {
      ...(x402Result.txHash ? { 'X-SettleGrid-Tx-Hash': x402Result.txHash } : {}),
    },
    {
      network: x402Result.network ?? null,
      scheme: x402Result.scheme ?? null,
      amountUsdc: x402Result.amountUsdc ?? null,
    }
  )
}

// ─── AP2 Proxy Handler ──────────────────────────────────────────────────────

async function handleAp2Proxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)

  const ap2Result = await validateAp2Payment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    merchantId: 'settlegrid_platform',
  })

  if (!ap2Result.valid) {
    logger.info('proxy.ap2_payment_required', {
      slug,
      costCents,
      errorCode: ap2Result.error?.code,
      requestId,
    })

    const ap2Response = generateAp2_402Response(toolRow.slug, costCents, toolRow.name)
    const body = await ap2Response.text()
    const headers = new Headers(ap2Response.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  return forwardAndBill(
    request, toolRow, 'ap2', costCents, slug, requestId, startTime,
    ap2Result.transactionId,
    ap2Result.consumerId,
    {},
    {
      ap2PaymentMethod: ap2Result.paymentMethod ?? null,
      ap2MandateType: ap2Result.mandateType ?? null,
    }
  )
}

// ─── Visa TAP Proxy Handler ─────────────────────────────────────────────────

async function handleVisaTapProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)

  const visaResult = await validateVisaTapPayment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    merchantId: 'settlegrid_platform',
  })

  if (!visaResult.valid) {
    logger.info('proxy.visa_tap_payment_required', {
      slug,
      costCents,
      errorCode: visaResult.error?.code,
      requestId,
    })

    const visaResponse = generateVisaTap402Response(toolRow.slug, costCents, toolRow.name)
    const body = await visaResponse.text()
    const headers = new Headers(visaResponse.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  return forwardAndBill(
    request, toolRow, 'visa-tap', costCents, slug, requestId, startTime,
    visaResult.authorizationCode,
    visaResult.tokenReferenceId,
    {
      ...(visaResult.authorizationCode ? { 'X-SettleGrid-Visa-Auth-Code': visaResult.authorizationCode } : {}),
      ...(visaResult.networkReferenceId ? { 'X-SettleGrid-Visa-Network-Ref': visaResult.networkReferenceId } : {}),
    },
    {
      visaTokenRef: visaResult.tokenReferenceId ?? null,
      visaAgentId: visaResult.agentId ?? null,
    }
  )
}

// ─── ACP Proxy Handler ──────────────────────────────────────────────────────

async function handleAcpProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)

  const acpResult = await validateAcpPayment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    recipientId: process.env.ACP_RECIPIENT_ID,
  })

  if (!acpResult.valid) {
    logger.info('proxy.acp_payment_required', {
      slug,
      costCents,
      errorCode: acpResult.error?.code,
      requestId,
    })

    const acpResponse = generateAcp402Response(toolRow.slug, costCents, toolRow.name)
    const body = await acpResponse.text()
    const headers = new Headers(acpResponse.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  return forwardAndBill(
    request, toolRow, 'acp', costCents, slug, requestId, startTime,
    acpResult.paymentIntentId ?? acpResult.checkoutSessionId,
    acpResult.customerId,
    {
      ...(acpResult.checkoutSessionId ? { 'X-SettleGrid-ACP-Session-Id': acpResult.checkoutSessionId } : {}),
    },
    {
      acpCheckoutSessionId: acpResult.checkoutSessionId ?? null,
      acpPaymentIntentId: acpResult.paymentIntentId ?? null,
    }
  )
}

// ─── Generic Protocol Proxy Handler (UCP, Mastercard, Circle Nano) ──────────

/**
 * Handles proxy invocations for UCP, Mastercard Agent Pay, and Circle Nanopayments.
 * These share the same lookup-validate-forward-bill pattern with protocol-specific
 * validation and 402 response generation.
 */
async function handleProtocolProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number,
  protocol: 'ucp' | 'mastercard-vi' | 'circle-nano' | 'alipay' | 'kyapay' | 'emvco' | 'drain'
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)
  const toolConfig = { slug: toolRow.slug, costCents, displayName: toolRow.name }

  let valid = false
  let paymentId: string | undefined
  let payerIdentifier: string | undefined
  let extraMeta: Record<string, unknown> = {}

  // Validate payment based on protocol
  if (protocol === 'ucp') {
    const result = await validateUcpPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.sessionId
    payerIdentifier = result.paymentHandler
    if (!valid) {
      const resp402 = generateUcp402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { ucpSessionId: result.sessionId ?? null, ucpPaymentHandler: result.paymentHandler ?? null }
  } else if (protocol === 'mastercard-vi') {
    const result = await validateMastercardPayment(request, { ...toolConfig, merchantId: 'settlegrid_platform' })
    valid = result.valid
    paymentId = result.authorizationRef ?? result.intentId
    payerIdentifier = result.intentId
    if (!valid) {
      const resp402 = generateMastercard402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { mcIntentId: result.intentId ?? null }
  } else if (protocol === 'circle-nano') {
    const result = await validateCircleNanoPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.confirmationId
    payerIdentifier = result.payerAddress
    if (!valid) {
      const resp402 = generateCircleNano402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { circleNanoConfirmationId: result.confirmationId ?? null, payerAddress: result.payerAddress ?? null }
  } else if (protocol === 'alipay') {
    const result = await validateAlipayPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.transactionRef
    payerIdentifier = result.agentId
    if (!valid) {
      const resp402 = generateAlipay402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { alipayTransactionRef: result.transactionRef ?? null, alipaySessionId: result.sessionId ?? null }
  } else if (protocol === 'kyapay') {
    const result = await validateKyaPayPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.tokenId
    payerIdentifier = result.principalId
    if (!valid) {
      const resp402 = generateKyaPay402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { kyapayTokenId: result.tokenId ?? null, kyapayAgentId: result.agentId ?? null, kyapayAuthorizedCents: result.authorizedAmountCents ?? null }
  } else if (protocol === 'emvco') {
    const result = await validateEmvcoPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.transactionRef
    payerIdentifier = result.tokenRef
    if (!valid) {
      const resp402 = generateEmvco402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { emvcoTransactionRef: result.transactionRef ?? null, emvcoNetwork: result.network ?? null, emvcoThreeDsRef: result.threeDsRef ?? null }
  } else if (protocol === 'drain') {
    const result = await validateDrainPayment(request, toolConfig)
    valid = result.valid
    paymentId = result.channelId
    payerIdentifier = result.payerAddress
    if (!valid) {
      const resp402 = generateDrain402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { drainChannelId: result.channelId ?? null, drainNonce: result.nonce ?? null, drainAmountUsdc: result.amountUsdc ?? null }
  }

  if (!valid) {
    return errorResponse('Payment validation failed.', 402, 'PAYMENT_REQUIRED', requestId)
  }

  return forwardAndBill(
    request, toolRow, protocol, costCents, slug, requestId, startTime,
    paymentId, payerIdentifier, {}, extraMeta
  )
}

// ─── L402 Proxy Handler ─────────────────────────────────────────────────────

async function handleL402Proxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)

  const l402Result = await validateL402Payment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
  })

  if (!l402Result.valid) {
    logger.info('proxy.l402_payment_required', {
      slug,
      costCents,
      errorCode: l402Result.error?.code,
      requestId,
    })

    // L402 402 response is async (generates Lightning invoice)
    const l402Response = await generateL402_402Response(toolRow.slug, costCents, toolRow.name)
    const body = await l402Response.text()
    const headers = new Headers(l402Response.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  return forwardAndBill(
    request, toolRow, 'l402', costCents, slug, requestId, startTime,
    l402Result.macaroonId,
    l402Result.preimageHash,
    {},
    {
      l402MacaroonId: l402Result.macaroonId ?? null,
      l402AmountSats: l402Result.amountSats ?? null,
    }
  )
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  return handleProxy(request, slug)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  return handleProxy(request, slug)
}
