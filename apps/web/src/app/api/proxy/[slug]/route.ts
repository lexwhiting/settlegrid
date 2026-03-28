import { NextRequest, NextResponse } from 'next/server'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools, developers, apiKeys, consumerToolBalances, invocations } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { isMppRequest, validateMppPayment, generateMpp402Response } from '@/lib/mpp'
import { isMppEnabled, getMppRecipientId } from '@/lib/env'

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

    // ── MPP Payment Flow ────────────────────────────────────────────────────
    // If the request contains MPP payment headers and MPP is enabled,
    // use the MPP payment flow instead of the standard API key flow.
    // This allows agents with Stripe SPTs to pay for tools directly.
    if (isMppEnabled() && isMppRequest(request)) {
      return handleMppProxy(request, slug, requestId, startTime)
    }

    // ── Standard API Key Flow ───────────────────────────────────────────────
    // Authenticate
    const auth = await authenticateProxyRequest(request, slug)
    if (!auth.ok) {
      return auth.error
    }

    const costCents = getCostCents(auth.tool.pricingConfig)

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

    // Record invocation
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
        metadata: {
          proxy: true,
          upstreamStatus,
          toolSlug: slug,
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
    if (requestId) {
      responseHeaders.set('x-request-id', requestId)
    }

    // Stream the response body back
    return new NextResponse(upstreamResponse.body, {
      status: upstreamStatus,
      headers: responseHeaders,
    })
  } catch (error) {
    const latencyMs = Date.now() - startTime
    logger.error('proxy.internal_error', { slug, latencyMs, requestId }, error)
    return internalErrorResponse(error, requestId)
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
  if (mppResult.paymentId) {
    responseHeaders.set('X-SettleGrid-MPP-Payment-Id', mppResult.paymentId)
  }
  if (requestId) {
    responseHeaders.set('x-request-id', requestId)
  }

  return new NextResponse(upstreamResponse.body, {
    status: upstreamStatus,
    headers: responseHeaders,
  })
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
