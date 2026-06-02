import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { eq, and, sql } from 'drizzle-orm'
import { createHash } from 'crypto'
import { db } from '@/lib/db'
import { tools, developers, apiKeys, consumerToolBalances, consumers, invocations } from '@/lib/db/schema'
import { hashApiKey } from '@/lib/crypto'
import { tryRedis, getRedis } from '@/lib/redis'
import { errorResponse, internalErrorResponse } from '@/lib/api'
import { sdkLimiter, checkRateLimit } from '@/lib/rate-limit'
import { getOrCreateRequestId } from '@/lib/request-id'
import { logger } from '@/lib/logger'
import { isIpInAllowlist } from '@/lib/ip-validation'
import { detectFraud, isIpBlocked, trackFailedAuth } from '@/lib/fraud'
import {
  findFallbackTool,
  shouldAttemptFailover,
  consumerCanAffordFailover,
  addFailoverHeaders,
  logFailoverEvent,
} from '@/lib/failover'
import { isMppRequest, validateMppPayment, generateMpp402Response } from '@/lib/mpp'
import { isX402Request, validateX402Payment, generateX402_402Response } from '@/lib/x402-proxy'
import { extractX402PaymentHeader, parseX402ExactPayload } from '@/lib/settlement/x402/parse'
import { executeX402Settlement } from '@/lib/settlement/x402/orchestrate'
import { executeCircleNanoSettlement } from '@/lib/settlement/circle-nano/settle'
import { parseCircleNanoProof } from '@settlegrid/mcp'
import { isAp2Request, validateAp2Payment, generateAp2_402Response } from '@/lib/ap2-proxy'
import { isVisaTapRequest, validateVisaTapPayment, generateVisaTap402Response } from '@/lib/visa-tap-proxy'
import { isAcpRequest, validateAcpPayment, generateAcp402Response } from '@/lib/acp-proxy'
import { isUcpRequest, isUcpEnabled, validateUcpPayment, generateUcp402Response } from '@/lib/ucp-proxy'
import { isMastercardRequest, isMastercardEnabled, mastercardAdapter, validateMastercardPayment, generateMastercard402Response } from '@/lib/mastercard-proxy'
import { isCircleNanoRequest, isCircleNanoEnabled, validateCircleNanoCredentialString, generateCircleNano402Response } from '@/lib/circle-nano-proxy'
import { isL402Request, isL402Enabled, validateL402Payment, generateL402_402Response } from '@/lib/l402-proxy'
import { isAlipayRequest, isAlipayEnabled, validateAlipayPayment, generateAlipay402Response } from '@/lib/alipay-proxy'
import { isKyaPayRequest, isKyaPayEnabled, validateKyaPayPayment, generateKyaPay402Response } from '@/lib/kyapay-proxy'
import { isEmvcoRequest, isEmvcoEnabled, validateEmvcoPayment, generateEmvco402Response } from '@/lib/emvco-proxy'
import { isDrainRequest, isDrainEnabled, validateDrainPayment, generateDrain402Response } from '@/lib/drain-proxy'
import {
  isMppEnabled,
  getMppRecipientId,
  isX402Enabled,
  isX402SettlementEnabled,
  isX402TestnetSettlementAllowed,
  getX402PaymentAddress,
  X402_MAINNET_NETWORK,
  isCircleNanoKernelEnabled,
  isAp2Enabled,
  isVisaTapEnabled,
  isAcpEnabled,
  useUnifiedAdapters,
} from '@/lib/env'
import { decideUnifiedDispatch, shouldDispatchUnified, type EnabledMap } from './_unified-dispatch'

// 90s budget: on the x402 path, confirm-before-deliver adds an on-chain
// settlement receipt wait (<= RECEIPT_TIMEOUT_MS = 30s) ahead of the upstream
// forward (<= UPSTREAM_TIMEOUT_MS = 30s). Other payment methods return well
// within this.
export const maxDuration = 90

const UPSTREAM_TIMEOUT_MS = 30_000
const DEFAULT_CACHE_TTL_SECONDS = 60

/**
 * Computes a SHA-256 hash of a request body for cache keying.
 */
function hashBody(body: string): string {
  return createHash('sha256').update(body).digest('hex').slice(0, 24)
}

/**
 * Extracts cacheTtlSeconds from the tool's pricing config.
 * Returns DEFAULT_CACHE_TTL_SECONDS if not configured, or 0 to disable caching.
 */
function getCacheTtl(pricingConfig: unknown): number {
  if (!pricingConfig || typeof pricingConfig !== 'object') return DEFAULT_CACHE_TTL_SECONDS
  const config = pricingConfig as Record<string, unknown>
  const ttl = config.cacheTtlSeconds
  if (typeof ttl === 'number' && Number.isFinite(ttl) && ttl >= 0) {
    return Math.floor(ttl)
  }
  return DEFAULT_CACHE_TTL_SECONDS
}

interface CachedProxyResponse {
  body: string
  status: number
  contentType: string
}

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

// ── P2.K1 — Unified-adapter dispatch (feature-flagged) ─────────────────
//
// When USE_UNIFIED_ADAPTERS=true, payment-protocol detection is delegated
// to protocolRegistry.detect() from @settlegrid/mcp (via the
// `decideUnifiedDispatch` helper in _unified-dispatch.ts) instead of the
// legacy 13-branch chain. This is a routing change only — once detected,
// the request is dispatched to the same legacy handler the 13-branch
// chain would have invoked, so behavior is preserved for the 9 brokered
// protocols. The 5 emerging protocols (l402, alipay/actp, kyapay, emvco,
// drain) don't have adapters in @settlegrid/mcp yet; the unified path
// returns 'no-match' for those, and the caller falls through to the
// legacy chain so emerging-protocol traffic is preserved either way.
//
// Default OFF until P2.K3 ships the snapshot-equivalence test and a
// snapshot run shows byte-for-byte parity for the 9 brokered protocols.

/**
 * Bridge from a unified-dispatch decision to the corresponding legacy
 * handler. Returns `null` when the caller should fall through (no match
 * or mcp-fallback). When a non-mcp adapter matched, returns the same
 * NextResponse the legacy chain would have produced.
 */
async function tryUnifiedAdapterDispatch(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number,
): Promise<NextResponse | null> {
  const decision = await decideUnifiedDispatch(request)

  // Per P2.K1 DoD ("Observability logs show path used"), tag each request
  // with one of three path values so a log search tells the full story:
  //   - 'unified-adapter'      : flag on, unified handled the request.
  //   - 'unified-then-legacy'  : flag on, unified fell through to legacy
  //                              chain (no-match, mcp-fallback, or
  //                              protocol-disabled).
  //   - 'legacy-13-branch'     : flag off (logged in handleProxy directly).
  //
  // Equivalence preservation: the legacy chain checks isXEnabled() before
  // each isXRequest(). The unified path here MUST do the same, otherwise
  // a request with mpp headers but no STRIPE_MPP_SECRET configured would
  // 5xx via handleMppProxy in unified mode but 401 (fall-through to API
  // key flow) in legacy mode — exactly the kind of silent divergence
  // P2.K3's snapshot test exists to catch. The pure shouldDispatchUnified
  // helper encapsulates this decision; production passes the real env
  // helpers, tests pass synthetic predicates.
  const enabledMap: EnabledMap = {
    mpp: isMppEnabled,
    x402: isX402Enabled,
    ap2: isAp2Enabled,
    'visa-tap': isVisaTapEnabled,
    acp: isAcpEnabled,
    ucp: isUcpEnabled,
    'mastercard-vi': isMastercardEnabled,
    'circle-nano': isCircleNanoEnabled,
    // P2.K2 — five emerging protocols now have adapter-registry entries
    // so their enabled-check is part of the equivalence contract too.
    l402: isL402Enabled,
    alipay: isAlipayEnabled,
    kyapay: isKyaPayEnabled,
    emvco: isEmvcoEnabled,
    drain: isDrainEnabled,
  }
  const verdict = shouldDispatchUnified(decision, enabledMap)

  if (!verdict.dispatch) {
    logger.info('proxy.dispatch', {
      path: 'unified-then-legacy',
      slug,
      requestId,
      reason: verdict.reason,
      protocol: verdict.protocol,
    })
    return null
  }

  logger.info('proxy.dispatch', {
    path: 'unified-adapter',
    slug,
    requestId,
    protocol: verdict.protocol,
    // Defensive optional chaining — `operation` is required by the
    // PaymentContext type, but a future adapter returning a malformed
    // shape would otherwise throw a TypeError on field access.
    operation: verdict.paymentContext?.operation
      ? `${verdict.paymentContext.operation.service}.${verdict.paymentContext.operation.method}`
      : undefined,
  })

  // All 8 non-mcp adapters route to one of three legacy handler
  // families. If a new adapter is added to @settlegrid/mcp, TypeScript's
  // exhaustiveness check below will surface this switch as incomplete.
  switch (verdict.protocol) {
    case 'mpp':
      return handleMppProxy(request, slug, requestId, startTime)
    case 'x402':
      return handleX402Proxy(request, slug, requestId, startTime)
    case 'ap2':
      return handleAp2Proxy(request, slug, requestId, startTime)
    case 'visa-tap':
      return handleVisaTapProxy(request, slug, requestId, startTime)
    case 'acp':
      return handleAcpProxy(request, slug, requestId, startTime)
    case 'ucp':
      return handleProtocolProxy(request, slug, requestId, startTime, 'ucp')
    case 'mastercard-vi':
      return handleProtocolProxy(request, slug, requestId, startTime, 'mastercard-vi')
    case 'circle-nano':
      return handleCircleNanoProxy(request, slug, requestId, startTime)
    // P2.K2 — five emerging protocols. L402 has its own handler (the
    // 402 response is async because it mints a Lightning invoice); the
    // other four route through the generic handleProtocolProxy switch.
    case 'l402':
      return handleL402Proxy(request, slug, requestId, startTime)
    case 'alipay':
      return handleProtocolProxy(request, slug, requestId, startTime, 'alipay')
    case 'kyapay':
      return handleProtocolProxy(request, slug, requestId, startTime, 'kyapay')
    case 'emvco':
      return handleProtocolProxy(request, slug, requestId, startTime, 'emvco')
    case 'drain':
      return handleProtocolProxy(request, slug, requestId, startTime, 'drain')
    case 'mcp':
      // Should not reach: decideUnifiedDispatch maps mcp → 'mcp-fallback'.
      return null
    default: {
      // Exhaustiveness: after all 9 ProtocolName cases above return,
      // `verdict` narrows to `never` here. Assigning the whole verdict
      // (not verdict.protocol — TS quirk: property access on a
      // never-narrowed variable resolves to `any`) preserves the
      // compile-time check. Adding a new adapter to @settlegrid/mcp
      // without updating this switch fails tsc on this line.
      const _exhaustive: never = verdict
      void _exhaustive
      logger.warn('proxy.unified.unhandled_adapter', { slug, requestId })
      return null
    }
  }
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
    // Rate limit by IP — extract first IP from x-forwarded-for (client IP)
    const rawForwardedFor = request.headers.get('x-forwarded-for') ?? 'unknown'
    const ip = rawForwardedFor.split(',')[0].trim()
    const rateLimit = await checkRateLimit(sdkLimiter, `proxy:${ip}`)
    if (!rateLimit.success) {
      return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED', requestId)
    }

    // ── P2.K1 — Unified-adapter dispatch (feature-flagged) ───────────────────
    // When USE_UNIFIED_ADAPTERS=true, route protocol detection through
    // protocolRegistry.detect() from @settlegrid/mcp first. Falls through
    // to the legacy chain below when no adapter matches (emerging
    // protocols) or the mcp adapter matches (api-key flow).
    // eslint-disable-next-line react-hooks/rules-of-hooks -- not a React hook; `use*` is the feature-flag reader convention in @/lib/env
    if (useUnifiedAdapters()) {
      const dispatched = await tryUnifiedAdapterDispatch(request, slug, requestId, startTime)
      if (dispatched !== null) return dispatched
    } else {
      // Legacy path observability — info level (low-volume) so we can
      // verify the rollout split via log search without noise.
      logger.info('proxy.dispatch', { path: 'legacy-13-branch', slug, requestId })
    }

    // ── Payment Protocol Detection Chain ────────────────────────────────────
    // Check each payment protocol in priority order. When a protocol is
    // enabled and the request matches its headers, use that protocol's
    // payment flow instead of the standard API key flow.
    //
    // P2.K3: The ordering below mirrors @settlegrid/mcp's DETECTION_PRIORITY
    // exactly — circle-nano before x402 (x402-compatible, more specific),
    // mastercard-vi immediately after x402. This matters ONLY for requests
    // that carry headers triggering more than one protocol (e.g. both
    // x-circle-nano-auth AND payment-signature); otherwise disjoint
    // triggers make order irrelevant. Matching the registry's order is
    // what enables the P2.K3 proxy-equivalence.test.ts snapshot test to
    // pass byte-for-byte — and therefore what makes the USE_UNIFIED_ADAPTERS
    // default-flip to `true` a no-op from the consumer's perspective.

    // 1. Stripe MPP (Machine Payments Protocol — Stripe + Tempo)
    if (isMppEnabled() && isMppRequest(request)) {
      return handleMppProxy(request, slug, requestId, startTime)
    }

    // 2. Circle Nanopayments (x402-compatible, more specific headers win)
    if (isCircleNanoEnabled() && isCircleNanoRequest(request)) {
      return handleCircleNanoProxy(request, slug, requestId, startTime)
    }

    // 3. x402 (Coinbase — USDC on Base blockchain)
    if (isX402Enabled() && isX402Request(request)) {
      return handleX402Proxy(request, slug, requestId, startTime)
    }

    // 4. Mastercard Verifiable Intent (SD-JWT credential chain)
    if (isMastercardEnabled() && isMastercardRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'mastercard-vi')
    }

    // 5. AP2 (Google Agentic Payments Protocol)
    if (isAp2Enabled() && isAp2Request(request)) {
      return handleAp2Proxy(request, slug, requestId, startTime)
    }

    // 6. ACP (Agentic Commerce Protocol — Stripe + OpenAI)
    if (isAcpEnabled() && isAcpRequest(request)) {
      return handleAcpProxy(request, slug, requestId, startTime)
    }

    // 7. UCP (Universal Commerce Protocol)
    if (isUcpEnabled() && isUcpRequest(request)) {
      return handleProtocolProxy(request, slug, requestId, startTime, 'ucp')
    }

    // 8. Visa TAP (Trusted Agent Protocol)
    if (isVisaTapEnabled() && isVisaTapRequest(request)) {
      return handleVisaTapProxy(request, slug, requestId, startTime)
    }

    // 9. L402 (Bitcoin Lightning)
    if (isL402Enabled() && isL402Request(request)) {
      return handleL402Proxy(request, slug, requestId, startTime)
    }

    // 10. ACTP (Alipay's Agentic Commerce Trust Protocol — Ant Group)
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
        // Fallback: check global balance (from credit packs)
        const [consumer] = await db
          .select({ globalBalanceCents: consumers.globalBalanceCents })
          .from(consumers)
          .where(eq(consumers.id, auth.consumerId))
          .limit(1)

        const globalBalance = consumer?.globalBalanceCents ?? 0
        const perToolBalance = balance?.balanceCents ?? 0

        if (globalBalance < costCents && perToolBalance < costCents) {
          return errorResponse(
            `Insufficient balance. Required: ${costCents} cents, available: ${perToolBalance} cents (tool) + ${globalBalance} cents (global).`,
            402,
            'INSUFFICIENT_BALANCE',
            requestId,
            { requiredCents: costCents, availableCents: perToolBalance, globalAvailableCents: globalBalance }
          )
        }
      }
    }

    // ── Edge Cache Check ─────────────────────────────────────────────────
    const cacheTtl = getCacheTtl(auth.tool.pricingConfig)
    let requestBody = ''
    if (request.method === 'POST') {
      try {
        requestBody = await request.text()
      } catch {
        requestBody = ''
      }
    }
    // Include cost in cache key so pricing changes automatically invalidate cached entries
    const cacheKey = cacheTtl > 0
      ? `cache:proxy:${slug}:c${costCents}:${hashBody(request.method + requestBody)}`
      : null

    if (cacheKey && cacheTtl > 0) {
      const cached = await tryRedis(() => getRedis().get<CachedProxyResponse>(cacheKey))
      if (cached) {
        // Cache HIT — still meter the invocation
        const latencyMs = Date.now() - startTime

        if (!auth.isTestKey && costCents > 0) {
          // Deduct from per-tool balance first; fallback to global
          const [updatedBalance] = await db
            .update(consumerToolBalances)
            .set({
              balanceCents: sql`${consumerToolBalances.balanceCents} - ${costCents}`,
              currentPeriodSpendCents: sql`${consumerToolBalances.currentPeriodSpendCents} + ${costCents}`,
            })
            .where(
              and(
                eq(consumerToolBalances.consumerId, auth.consumerId),
                eq(consumerToolBalances.toolId, auth.toolId),
                sql`${consumerToolBalances.balanceCents} >= ${costCents}`
              )
            )
            .returning({ balanceCents: consumerToolBalances.balanceCents })

          if (!updatedBalance) {
            // Try global balance fallback
            await db
              .update(consumers)
              .set({ globalBalanceCents: sql`${consumers.globalBalanceCents} - ${costCents}` })
              .where(
                and(
                  eq(consumers.id, auth.consumerId),
                  sql`${consumers.globalBalanceCents} >= ${costCents}`
                )
              )
          }

          // Awaited — see proxy.billing_update_error rationale above.
          try {
            await Promise.all([
              db.update(tools).set({
                totalInvocations: sql`${tools.totalInvocations} + 1`,
                totalRevenueCents: sql`${tools.totalRevenueCents} + ${costCents}`,
                updatedAt: new Date(),
              }).where(eq(tools.id, auth.toolId)),
              db.update(developers).set({
                balanceCents: sql`${developers.balanceCents} + ${costCents}`,
                updatedAt: new Date(),
              }).where(eq(developers.id, auth.tool.developerId)),
            ])
          } catch (err) {
            logger.error('proxy.cached_billing_update_error', { slug, requestId }, err)
          }
        }

        // Record the (cached) invocation
        db.insert(invocations).values({
          toolId: auth.toolId,
          consumerId: auth.consumerId,
          apiKeyId: auth.keyId,
          method: `proxy:${request.method}`,
          costCents: auth.isTestKey ? 0 : costCents,
          latencyMs,
          status: 'success',
          isTest: auth.isTestKey,
          isFlagged: fraudResult.flagged,
          metadata: { proxy: true, cached: true, toolSlug: slug },
        }).then(() => {}).catch(() => {})

        const cacheHeaders = new Headers()
        cacheHeaders.set('Content-Type', cached.contentType)
        cacheHeaders.set('X-SettleGrid-Proxy', 'true')
        cacheHeaders.set('X-SettleGrid-Cache', 'HIT')
        cacheHeaders.set('X-SettleGrid-Cost-Cents', String(auth.isTestKey ? 0 : costCents))
        cacheHeaders.set('X-SettleGrid-Latency-Ms', String(latencyMs))
        if (requestId) cacheHeaders.set('x-request-id', requestId)

        return new NextResponse(cached.body, {
          status: cached.status,
          headers: cacheHeaders,
        })
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
        // If we already consumed the body for cache key, use the captured text
        if (requestBody) {
          fetchInit.body = requestBody
        } else {
          fetchInit.body = request.body
          // Enable streaming of request body
          // @ts-expect-error -- duplex is required for streaming request bodies in fetch but not in the TS types yet
          fetchInit.duplex = 'half'
        }
      }

      upstreamResponse = await fetch(auth.tool.proxyEndpoint, fetchInit)
    } catch (err) {
      clearTimeout(timeout)
      const latencyMs = Date.now() - startTime
      const isAbort = err instanceof Error && err.name === 'AbortError'

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

      // ── SLA Failover on upstream error ──────────────────────────────
      if (shouldAttemptFailover(0, isAbort)) {
        const pricingConfig = auth.tool.pricingConfig as Record<string, unknown> | null
        const toolCategory = typeof pricingConfig?.category === 'string'
          ? pricingConfig.category
          : null

        // Look up category from the tool itself if not in pricing config
        const effectiveCategory = toolCategory ?? await getToolCategory(auth.toolId)

        if (effectiveCategory) {
          const canAfford = auth.isTestKey || costCents <= 0 || await consumerCanAffordFailover(auth.consumerId, costCents)
          if (canAfford) {
            const fallbackResult = await attemptFailover({
              slug,
              category: effectiveCategory,
              consumerId: auth.consumerId,
              costCents,
              request,
              requestBody,
              startTime,
              requestId,
              isTestKey: auth.isTestKey,
              keyId: auth.keyId,
              toolId: auth.toolId,
              developerId: auth.tool.developerId,
              flagged: fraudResult.flagged,
              originalStatus: null,
            })
            if (fallbackResult) return fallbackResult
          }
        }
      }

      if (isAbort) {
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

    // ── SLA Failover on 5xx response ──────────────────────────────────
    if (!upstreamOk && shouldAttemptFailover(upstreamStatus, false)) {
      const effectiveCategory = await getToolCategory(auth.toolId)
      if (effectiveCategory) {
        const canAfford = auth.isTestKey || costCents <= 0 || await consumerCanAffordFailover(auth.consumerId, costCents)
        if (canAfford) {
          const fallbackResult = await attemptFailover({
            slug,
            category: effectiveCategory,
            consumerId: auth.consumerId,
            costCents,
            request,
            requestBody,
            startTime,
            requestId,
            isTestKey: auth.isTestKey,
            keyId: auth.keyId,
            toolId: auth.toolId,
            developerId: auth.tool.developerId,
            flagged: fraudResult.flagged,
            originalStatus: upstreamStatus,
          })
          if (fallbackResult) return fallbackResult
        }
      }
    }

    // Only charge if upstream returned success
    const actualCost = upstreamOk && !auth.isTestKey ? costCents : 0

    // Consumer-audit #2 — track actual collected cents separately from the
    // intended cost. The atomic UPDATEs below may fail when two concurrent
    // invocations drain the balance between the pre-check and the deduct.
    // If the deduct fails we must NOT credit the developer — the upstream
    // response already shipped (a free invocation), but paying the dev from
    // a phantom balance would create a revenue leak and negative-sum
    // accounting. Previously the revenue/balance updates ran unconditionally
    // on `actualCost > 0` regardless of whether the money actually moved.
    let collectedCents = 0
    let collectedFrom: 'per_tool' | 'global' | 'none' = 'none'

    if (actualCost > 0) {
      // Atomic per-tool balance deduction (conditional on sufficient funds).
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

      if (updatedBalance) {
        collectedCents = actualCost
        collectedFrom = 'per_tool'
      } else {
        // Per-tool balance insufficient — fallback to global balance.
        const [globalDeduct] = await db
          .update(consumers)
          .set({
            globalBalanceCents: sql`${consumers.globalBalanceCents} - ${actualCost}`,
          })
          .where(
            and(
              eq(consumers.id, auth.consumerId),
              sql`${consumers.globalBalanceCents} >= ${actualCost}`
            )
          )
          .returning({ globalBalanceCents: consumers.globalBalanceCents })

        if (globalDeduct) {
          collectedCents = actualCost
          collectedFrom = 'global'
        } else {
          // Both conditional UPDATEs failed — the consumer's balance was
          // drained by a concurrent invocation between our pre-check and
          // this deduct. The upstream already ran. Log at ERROR level (not
          // warn) so ops can reconcile, and return the response to the
          // consumer without crediting the developer.
          logger.error('proxy.balance_race_unpaid_invocation', {
            slug,
            consumerId: auth.consumerId,
            toolId: auth.toolId,
            costCents: actualCost,
            requestId,
            message: 'Concurrent invocation drained balance between pre-check and deduct. Upstream shipped; no charge collected; developer not credited.',
          })
        }
      }
      // Only credit tool revenue + developer balance if we actually collected.
      if (collectedCents > 0) {
        // MUST be awaited — Vercel kills serverless containers as soon
        // as the response is sent, which kills the Postgres connection
        // mid-handshake and silently drops the writes (verified
        // 2026-05-06: every billed invocation lost developer credit
        // because of fire-and-forget Promise.all + CONNECT_TIMEOUT).
        try {
          await Promise.all([
            db
              .update(tools)
              .set({
                totalInvocations: sql`${tools.totalInvocations} + 1`,
                totalRevenueCents: sql`${tools.totalRevenueCents} + ${collectedCents}`,
                updatedAt: new Date(),
              })
              .where(eq(tools.id, auth.toolId)),
            db
              .update(developers)
              .set({
                balanceCents: sql`${developers.balanceCents} + ${collectedCents}`,
                updatedAt: new Date(),
              })
              .where(eq(developers.id, auth.tool.developerId)),
          ])
        } catch (err) {
          logger.error('proxy.billing_update_error', { slug, requestId }, err)
        }
      } else {
        // Lost race: still increment invocation count so activity metrics
        // reflect reality, but do NOT touch revenue or developer balance.
        db.update(tools)
          .set({
            totalInvocations: sql`${tools.totalInvocations} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(tools.id, auth.toolId))
          .catch(() => {})
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

    // Record invocation (with fraud flag, test mode, and the balance-race
    // outcome so reconciliation queries can find unpaid invocations).
    db.insert(invocations)
      .values({
        toolId: auth.toolId,
        consumerId: auth.consumerId,
        apiKeyId: auth.keyId,
        method: `proxy:${request.method}`,
        costCents: collectedCents,
        latencyMs,
        status: upstreamOk ? 'success' : 'error',
        isTest: auth.isTestKey,
        isFlagged: fraudResult.flagged,
        metadata: {
          proxy: true,
          upstreamStatus,
          toolSlug: slug,
          // Preserve the intended vs. collected split for reconciliation.
          intendedCostCents: actualCost,
          collectedCostCents: collectedCents,
          collectedFrom,
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
    responseHeaders.set('X-SettleGrid-Cache', 'MISS')
    if (auth.isTestKey) {
      responseHeaders.set('X-SettleGrid-Mode', 'sandbox')
    }
    if (requestId) {
      responseHeaders.set('x-request-id', requestId)
    }

    // ── Cache successful responses ────────────────────────────────────
    if (cacheKey && cacheTtl > 0 && upstreamOk) {
      try {
        const respText = await upstreamResponse.text()
        const contentType = upstreamResponse.headers.get('content-type') ?? 'application/json'
        const toCache: CachedProxyResponse = {
          body: respText,
          status: upstreamStatus,
          contentType,
        }
        // Store in Redis asynchronously (non-blocking)
        tryRedis(() => getRedis().set(cacheKey, JSON.stringify(toCache), { ex: cacheTtl })).catch(() => {})

        // Return the response using the text we already consumed
        return injectAttributionAndReturnText(respText, responseHeaders, upstreamStatus, slug, actualCost, 'api-key', contentType)
      } catch {
        // Fall through to normal response flow
      }
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
 * Injects `_settlegrid` metadata into an already-consumed text body.
 * Used when the body was consumed for caching.
 */
function injectAttributionAndReturnText(
  text: string,
  responseHeaders: Headers,
  upstreamStatus: number,
  toolSlug: string,
  costCents: number,
  protocol: string,
  contentType: string
): NextResponse {
  const isJson = contentType.includes('application/json')

  if (!isJson) {
    return new NextResponse(text, {
      status: upstreamStatus,
      headers: responseHeaders,
    })
  }

  try {
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
    return new NextResponse(text, {
      status: upstreamStatus,
      headers: responseHeaders,
    })
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
    // Awaited — see proxy.billing_update_error rationale above.
    try {
      await Promise.all([
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
            balanceCents: sql`${developers.balanceCents} + ${actualCost}`,
            updatedAt: new Date(),
          })
          .where(eq(developers.id, toolRow.developerId)),
      ])
    } catch (err) {
      logger.error('proxy.mpp_billing_update_error', { slug, requestId }, err)
    }
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
  extraMetadata?: Record<string, unknown>,
  options?: {
    /**
     * Skip the developer-balance / tool-revenue credit (F1). Set ONLY for an
     * x402 idempotent replay or concurrent-flip-loser: the buyer paid once and
     * was already credited by the flip winner, so re-delivering must NOT
     * re-credit. The request is still forwarded; the invocation is recorded as a
     * non-billed replay (costCents 0).
     */
    skipCredit?: boolean
    /**
     * F3: the payment already settled IRREVERSIBLY on-chain BEFORE this forward
     * (x402 exact / EIP-3009). Enables an actionable funds-loss alert on the
     * branches where the buyer is charged but the dev is credited 0 and no refund
     * is possible: (a) upstream fails to deliver (fetch throw / non-2xx), (b) the
     * billing UPDATE throws. Reversible/prepaid rails leave this false — an
     * upstream failure there costs nothing (actualCost 0, nothing charged). NO
     * auto-refund (a new irreversible money path needs its own audit); the alert
     * drives a manual off-band refund runbook keyed by txHash + payer.
     */
    irreversibleOnChain?: boolean
  }
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

    if (options?.irreversibleOnChain) {
      // F3: the on-chain payment already settled (irreversible) but the upstream
      // tool was NOT delivered (unreachable / timeout) → buyer charged, dev
      // credited 0, NO auto-refund. Distinct, alertable signal for the off-band
      // refund runbook (keyed by txHash + payer). The buyer's idempotent retry
      // can still deliver (F1 forwards a now-settled replay without re-charging).
      logger.error('proxy.onchain_settled_upstream_failed', {
        slug, requestId, paymentMethod,
        txHash: paymentId, payer: payerIdentifier, costCents,
        upstreamStatus: null, reason: 'upstream_unreachable',
        error: err instanceof Error ? err.message : String(err),
      })
    }

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
  // F1: a non-billed replay re-delivers but is NEVER credited (the flip winner
  // already credited the single on-chain payment) → its recorded cost is 0.
  const skipCredit = options?.skipCredit === true
  const actualCost = upstreamOk && !skipCredit ? costCents : 0

  if (upstreamOk && !skipCredit) {
    // Awaited — see proxy.billing_update_error rationale above.
    try {
      await Promise.all([
        db.update(tools).set({
          totalInvocations: sql`${tools.totalInvocations} + 1`,
          totalRevenueCents: sql`${tools.totalRevenueCents} + ${actualCost}`,
          updatedAt: new Date(),
        }).where(eq(tools.id, toolRow.id)),
        db.update(developers).set({
          balanceCents: sql`${developers.balanceCents} + ${actualCost}`,
          updatedAt: new Date(),
        }).where(eq(developers.id, toolRow.developerId)),
      ])
    } catch (err) {
      logger.error(`proxy.${paymentMethod}_billing_update_error`, { slug, requestId }, err)
      if (options?.irreversibleOnChain) {
        // F3: STOP SWALLOWING. The credit is the payout source of truth and the
        // on-chain charge is irreversible — a lost credit here means the buyer
        // paid + WAS served but the dev was never credited. Distinct, alertable
        // signal so an operator credits manually (keyed by txHash + payer).
        logger.error('proxy.onchain_credit_lost_after_settle', {
          slug, requestId, paymentMethod,
          txHash: paymentId, payer: payerIdentifier, costCents, upstreamStatus,
        })
      }
    }
  } else if (!upstreamOk && options?.irreversibleOnChain && !skipCredit) {
    // F3: settled on-chain (irreversible) but upstream returned non-2xx → buyer
    // charged, nothing delivered, dev credited 0, NO auto-refund. Distinct,
    // alertable signal for the off-band refund runbook (keyed by txHash + payer).
    // The buyer's idempotent retry can still deliver (F1 forwards a now-settled
    // replay without re-charging).
    logger.error('proxy.onchain_settled_upstream_failed', {
      slug, requestId, paymentMethod,
      txHash: paymentId, payer: payerIdentifier, costCents, upstreamStatus,
      reason: 'upstream_non_2xx',
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

  // Consistent x402 JSON error envelope (+ request id).
  const x402Error = (code: string, message: string, status: number): NextResponse => {
    const headers = new Headers({ 'Content-Type': 'application/json' })
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(JSON.stringify({ error: { code, message } }), { status, headers })
  }

  // Dark-gate: x402 settles on-chain ONLY when the gas wallet + platform payee
  // are both configured. Until then x402 is NOT accepted — we must not
  // structural-accept + credit a developer balance for a payment that never
  // settles on-chain (payouts draw on that balance), nor advertise a payable 402
  // with a ZERO_ADDRESS payTo. See isX402SettlementEnabled.
  if (!isX402SettlementEnabled()) {
    logger.info('proxy.x402_not_configured', { slug, requestId })
    return x402Error('X402_NOT_CONFIGURED', 'x402 settlement is not currently available on this SettleGrid instance.', 503)
  }
  const recipient = getX402PaymentAddress()
  if (!recipient || !isAddress(recipient, { strict: false })) {
    // Set-but-invalid: fail closed LOUDLY (mirrors circle-nano) so a
    // misconfigured deploy is diagnosable rather than mis-paying.
    logger.warn('proxy.x402_recipient_misconfigured', { slug, requestId })
    return x402Error('X402_NOT_CONFIGURED', 'x402 settlement recipient is misconfigured.', 503)
  }

  // Structural gate: is a plausibly-valid x402 payment present? Missing /
  // expired / underpaid → 402 challenge so the client knows to pay. Structural
  // ONLY (the app wrapper omits a facilitator) — the orchestrator below is the
  // sole settle path.
  const x402Result = await validateX402Payment(request, {
    slug: toolRow.slug,
    costCents,
    displayName: toolRow.name,
    recipientAddress: recipient,
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

  // Free op (cost <= 0): no USDC moves; forward without settlement (parity with
  // circle-nano's free-call path). A tool always has an owning developer.
  if (costCents <= 0) {
    return forwardAndBill(
      request, toolRow, 'x402', costCents, slug, requestId, startTime,
      undefined,
      x402Result.payerAddress,
      {},
      { network: x402Result.network ?? null, scheme: 'exact', amountUsdc: x402Result.amountUsdc ?? null }
    )
  }

  // Decode the FULL exact authorization for the on-chain settle (the SDK result
  // does not surface signature / nonce / to). v1 settles the EXACT scheme only;
  // a non-exact or malformed payload that slipped the structural gate → 402.
  const headerValue = extractX402PaymentHeader(request)
  const exactPayload = headerValue ? parseX402ExactPayload(headerValue) : null
  if (!exactPayload) {
    logger.info('proxy.x402_scheme_unsupported', { slug, scheme: x402Result.scheme, requestId })
    return x402Error('X402_SCHEME_UNSUPPORTED', 'Only the x402 exact scheme (EIP-3009) is settled. Re-send an exact-scheme payment.', 402)
  }

  // F2: production network-pin. The orchestrator's offline verifier accepts ANY
  // network present in USDC_EIP712_DOMAINS (Base mainnet AND Base Sepolia), so on
  // a mainnet deploy a Sepolia-network payload would settle with FREE testnet USDC
  // yet credit a real, withdrawable developer balance. Hard-pin production to Base
  // mainnet; testnet is accepted only in non-prod behind SETTLEGRID_X402_ALLOW_TESTNET.
  if (exactPayload.network !== X402_MAINNET_NETWORK && !isX402TestnetSettlementAllowed()) {
    logger.warn('proxy.x402_network_unsupported', { slug, network: exactPayload.network, requestId })
    return x402Error(
      'X402_NETWORK_UNSUPPORTED',
      `x402 settlement requires the Base mainnet network (${X402_MAINNET_NETWORK}).`,
      402
    )
  }

  // REAL ON-CHAIN SETTLEMENT — confirm-before-deliver (mirrors circle-nano A2 +
  // the canonical x402 facilitator). The orchestrator verifies (recover signer +
  // payee-bind + EXACT amount + Base-only), settles via the gas wallet, waits for
  // a CONFIRMED receipt, and records the unified-ledger row. Forward + bill ONLY
  // on a confirmed settle; a reverted / unconfirmed / in-progress settle is NEVER
  // delivered or billed.
  const outcome = await executeX402Settlement({
    payload: exactPayload,
    costCents,
    accountId: toolRow.developerId,
    toolId: toolRow.id,
    toolSlug: toolRow.slug,
    method: `proxy:${request.method}`,
    recipient,
  })

  if (outcome.status !== 'settled') {
    logger.info('proxy.x402_not_settled', { slug, outcomeStatus: outcome.status, code: outcome.code, requestId })
    return x402Error(outcome.code, outcome.reason, outcome.httpStatus)
  }

  // F1: a replayed / concurrent-loser authorization settled in a PRIOR invocation
  // (alreadySettled) — the buyer paid exactly once and was already credited by the
  // flip winner. Still forward (honor the paid request) but SKIP the credit and tag
  // a non-billed replay; otherwise an SDK auto-retry would re-credit the payout
  // balance for one on-chain receipt.
  const isReplay = outcome.alreadySettled === true
  if (isReplay) {
    logger.info('proxy.x402_replay_no_recredit', { slug, txHash: outcome.txHash, requestId })
  }

  return forwardAndBill(
    request, toolRow, 'x402', costCents, slug, requestId, startTime,
    outcome.txHash,
    exactPayload.payload.authorization.from,
    { 'X-SettleGrid-Tx-Hash': outcome.txHash },
    {
      network: exactPayload.network,
      scheme: 'exact',
      amountUsdc: exactPayload.payload.authorization.value,
      ...(isReplay ? { replay: true } : {}),
    },
    isReplay ? { skipCredit: true } : { irreversibleOnChain: true }
  )
}

// ─── Circle Nanopayments Proxy Handler ───────────────────────────────────────
// Direct-proxy circle-nano (x-circle-nano-auth header, EIP-3009). Mirrors
// handleX402Proxy: SETTLE the authorization ON-CHAIN in-path (confirm-before-
// deliver), then forward + credit ONLY on a confirmed settle — so the proxy never
// credits a withdrawable developer balance for USDC it never collected (the
// funds-safety fix; payouts draw on that balance). Isolated from the generic
// handleProtocolProxy (the 6 forward-only rails) so the money path mirrors the
// proven+sealed x402 handler. The exactly-once credit gate is the orchestrator's
// single WHERE-pending flip (alreadySettled ⇒ skipCredit).
async function handleCircleNanoProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number
): Promise<NextResponse> {
  const lookup = await lookupToolBySlug(slug, requestId)
  if (!lookup.ok) return lookup.error
  const { toolRow } = lookup

  const costCents = getCostCents(toolRow.pricingConfig)
  const toolConfig = { slug: toolRow.slug, costCents, displayName: toolRow.name }

  // Dark-gate (the money boundary): circle-nano settles on-chain ONLY when the gas
  // wallet + platform payee (SETTLEGRID_USDC_RECIPIENT) are configured. Until then
  // do NOT accept it — we must never credit a developer balance (payouts draw on it)
  // for a payment that cannot settle. This closes the phantom-credit hole regardless
  // of the dispatch enable-gate.
  if (!isCircleNanoKernelEnabled()) {
    logger.info('proxy.circle_nano_not_configured', { slug, requestId })
    return errorResponse(
      'Circle Nanopayment settlement is not currently available on this SettleGrid instance.',
      503,
      'CIRCLE_NANO_NOT_CONFIGURED',
      requestId,
    )
  }

  // Authoritative offline verification (EIP-712 signature recovery + payee + amount
  // + time window) — the SAME gate as the kernel facilitator route. The EIP-3009
  // authorization rides in the x-circle-nano-auth header. Missing / invalid → 402.
  const header = request.headers.get('x-circle-nano-auth')
  const validation = await validateCircleNanoCredentialString(header, toolConfig)
  if (!validation.valid) {
    logger.info('proxy.circle_nano_payment_required', {
      slug,
      costCents,
      errorCode: validation.error?.code,
      requestId,
    })
    const resp402 = generateCircleNano402Response(toolRow.slug, costCents, toolRow.name)
    const body = await resp402.text()
    const headers = new Headers(resp402.headers)
    if (requestId) headers.set('x-request-id', requestId)
    return new NextResponse(body, { status: 402, headers })
  }

  // Free op (cost <= 0): no USDC moves; forward without settlement (parity with the
  // x402 free-call path). A tool always has an owning developer.
  if (costCents <= 0) {
    return forwardAndBill(
      request, toolRow, 'circle-nano', costCents, slug, requestId, startTime,
      undefined,
      validation.payerAddress,
      {},
      { circleNanoConfirmationId: validation.confirmationId ?? null, payerAddress: validation.payerAddress ?? null }
    )
  }

  // Decode the full EIP-3009 proof for the on-chain settle (signature / nonce / to).
  const proof = header ? parseCircleNanoProof(header) : null
  if (!proof) {
    logger.info('proxy.circle_nano_auth_unparseable', { slug, requestId })
    return errorResponse(
      'The Circle Nanopayment authorization could not be parsed. Re-send a valid x-circle-nano-auth header.',
      402, 'CIRCLE_NANO_AUTH_INVALID', requestId,
    )
  }

  // F2: production network-pin (mirror handleX402Proxy). The verifier accepts ANY
  // network in USDC_EIP712_DOMAINS (Base mainnet AND Sepolia), so on a mainnet deploy
  // a Sepolia payload would settle FREE testnet USDC yet credit a real, withdrawable
  // balance. Hard-pin prod to Base mainnet; testnet only in non-prod behind the flag
  // (which bakes in !isProduction()). Reuses x402's pin — both rails are Base USDC.
  if (proof.network !== X402_MAINNET_NETWORK && !isX402TestnetSettlementAllowed()) {
    logger.warn('proxy.circle_nano_network_unsupported', { slug, network: proof.network, requestId })
    return errorResponse(
      `Circle Nanopayment settlement requires the Base mainnet network (${X402_MAINNET_NETWORK}).`,
      402, 'CIRCLE_NANO_NETWORK_UNSUPPORTED', requestId,
    )
  }

  // REAL ON-CHAIN SETTLEMENT — confirm-before-deliver (mirror handleX402Proxy + the
  // kernel /settle route). The orchestrator owns idempotency (stable
  // network:from:nonce operation_id), a write-ahead pending row, a per-authorization
  // lock, and the guarded flip; it submits via the gas wallet and waits for a
  // CONFIRMED receipt. Forward + bill ONLY on a confirmed settle.
  const outcome = await executeCircleNanoSettlement({
    proof,
    costCents,
    accountId: toolRow.developerId,
    toolId: toolRow.id,
    toolSlug: toolRow.slug,
    method: `proxy:${request.method}`,
    latencyMs: Date.now() - startTime,
  })

  if (outcome.status !== 'settled') {
    // failed | pending — the USDC did not (confirmably) move. Surface the structured
    // error; never forward or credit.
    logger.info('proxy.circle_nano_not_settled', { slug, outcomeStatus: outcome.status, code: outcome.code, requestId })
    return errorResponse(outcome.reason, outcome.httpStatus, outcome.code, requestId)
  }

  // F1: a replayed / concurrent-loser authorization settled in a PRIOR invocation
  // (alreadySettled) — the buyer paid exactly once and was already credited by the
  // flip winner. Still forward (honor the paid request) but SKIP the credit so an SDK
  // auto-retry can't re-credit the payout balance for one on-chain receipt.
  const isReplay = outcome.alreadySettled === true
  if (isReplay) {
    logger.info('proxy.circle_nano_replay_no_recredit', { slug, txHash: outcome.txHash, requestId })
  }

  return forwardAndBill(
    request, toolRow, 'circle-nano', costCents, slug, requestId, startTime,
    outcome.txHash,
    proof.authorization.from,
    { 'X-SettleGrid-Tx-Hash': outcome.txHash },
    {
      network: proof.network,
      payer: proof.authorization.from,
      amountUsdc: proof.authorization.value,
      ...(isReplay ? { replay: true } : {}),
    },
    isReplay ? { skipCredit: true } : { irreversibleOnChain: true }
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
 * Handles proxy invocations for UCP, Mastercard Verifiable Intent, and Circle Nanopayments.
 * These share the same lookup-validate-forward-bill pattern with protocol-specific
 * validation and 402 response generation.
 */
async function handleProtocolProxy(
  request: NextRequest,
  slug: string,
  requestId: string,
  startTime: number,
  protocol: 'ucp' | 'mastercard-vi' | 'alipay' | 'kyapay' | 'emvco' | 'drain'
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
      // P3.PROT1 — Mastercard VI is a detection stub: full validation lands
      // when Mastercard's Verifiable Intent API GAs (target 2026-Q3). When
      // the validator returns ``MC_NOT_YET_SUPPORTED`` we surface the
      // spec-literal 503 detection-stub envelope (``status: 'protocol_detected'``,
      // ``expected_at: '2026-Q3'``, etc.) so the buyer's client sees a
      // structured "coming soon" signal rather than a 402 "please pay
      // properly" challenge for a rail we can't yet validate.
      // Other failure codes (`MC_NOT_CONFIGURED`, `MC_INTENT_MISSING`)
      // continue to fall through to the legacy 402 challenge path.
      if (result.error?.code === 'MC_NOT_YET_SUPPORTED') {
        const stub = mastercardAdapter.buildDetectionStubResponse()
        const body = await stub.text()
        const headers = new Headers(stub.headers)
        if (requestId) headers.set('x-request-id', requestId)
        return new NextResponse(body, { status: stub.status, headers })
      }
      const resp402 = generateMastercard402Response(toolRow.slug, costCents, toolRow.name)
      const body = await resp402.text()
      const headers = new Headers(resp402.headers)
      if (requestId) headers.set('x-request-id', requestId)
      return new NextResponse(body, { status: 402, headers })
    }
    extraMeta = { mcIntentId: result.intentId ?? null }
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

// ── SLA Failover Helpers ───────────────────────────────────────────────────

/**
 * Look up a tool's category from the database.
 */
async function getToolCategory(toolId: string): Promise<string | null> {
  try {
    const [row] = await db
      .select({ category: tools.category })
      .from(tools)
      .where(eq(tools.id, toolId))
      .limit(1)
    return row?.category ?? null
  } catch {
    return null
  }
}

interface FailoverParams {
  slug: string
  category: string
  consumerId: string
  costCents: number
  request: NextRequest
  requestBody: string
  startTime: number
  requestId: string
  isTestKey: boolean
  keyId: string
  toolId: string
  developerId: string
  flagged: boolean
  originalStatus: number | null
}

/**
 * Attempts a single failover to a fallback tool in the same category.
 * Returns a NextResponse if failover succeeds, or null if it fails.
 * Bills at the ORIGINAL tool's rate, not the fallback's rate.
 */
async function attemptFailover(params: FailoverParams): Promise<NextResponse | null> {
  const {
    slug, category, consumerId, costCents, request, requestBody,
    startTime, requestId, isTestKey, keyId, toolId, developerId,
    flagged, originalStatus,
  } = params

  try {
    const fallback = await findFallbackTool(slug, category)
    if (!fallback) return null

    logger.info('proxy.failover_attempt', {
      originalSlug: slug,
      fallbackSlug: fallback.slug,
      consumerId,
      requestId,
    })

    // Call the fallback tool
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS)

    let fallbackResponse: Response
    try {
      const fetchInit: RequestInit = {
        method: request.method,
        headers: buildUpstreamHeaders(request),
        signal: controller.signal,
      }

      if (request.method !== 'GET' && request.method !== 'HEAD' && requestBody) {
        fetchInit.body = requestBody
      }

      fallbackResponse = await fetch(fallback.proxyEndpoint, fetchInit)
    } catch {
      clearTimeout(timer)
      return null // Fallback also failed — give up
    } finally {
      clearTimeout(timer)
    }

    const fallbackStatus = fallbackResponse.status
    const fallbackOk = fallbackStatus >= 200 && fallbackStatus < 300

    if (!fallbackOk) {
      return null // Fallback returned an error — give up
    }

    const latencyMs = Date.now() - startTime
    const actualCost = !isTestKey ? costCents : 0

    // Bill at original tool's rate
    if (actualCost > 0) {
      const [updatedBalance] = await db
        .update(consumerToolBalances)
        .set({
          balanceCents: sql`${consumerToolBalances.balanceCents} - ${actualCost}`,
          currentPeriodSpendCents: sql`${consumerToolBalances.currentPeriodSpendCents} + ${actualCost}`,
        })
        .where(
          and(
            eq(consumerToolBalances.consumerId, consumerId),
            eq(consumerToolBalances.toolId, toolId),
            sql`${consumerToolBalances.balanceCents} >= ${actualCost}`
          )
        )
        .returning({ balanceCents: consumerToolBalances.balanceCents })

      if (!updatedBalance) {
        await db
          .update(consumers)
          .set({
            globalBalanceCents: sql`${consumers.globalBalanceCents} - ${actualCost}`,
          })
          .where(
            and(
              eq(consumers.id, consumerId),
              sql`${consumers.globalBalanceCents} >= ${actualCost}`
            )
          )
      }

      // Credit the original developer
      // Awaited — see proxy.billing_update_error rationale above.
      try {
        await Promise.all([
          db.update(tools).set({
            totalInvocations: sql`${tools.totalInvocations} + 1`,
            totalRevenueCents: sql`${tools.totalRevenueCents} + ${actualCost}`,
            updatedAt: new Date(),
          }).where(eq(tools.id, toolId)),
          db.update(developers).set({
            balanceCents: sql`${developers.balanceCents} + ${actualCost}`,
            updatedAt: new Date(),
          }).where(eq(developers.id, developerId)),
        ])
      } catch (err) {
        logger.error('proxy.failover_billing_update_error', { slug, requestId }, err)
      }
    }

    // Record the invocation
    db.insert(invocations).values({
      toolId,
      consumerId,
      apiKeyId: keyId,
      method: `proxy:${request.method}`,
      costCents: actualCost,
      latencyMs,
      status: 'success',
      isTest: isTestKey,
      isFlagged: flagged,
      metadata: {
        proxy: true,
        failover: true,
        originalSlug: slug,
        fallbackSlug: fallback.slug,
        originalStatus,
      },
    }).then(() => {}).catch(() => {})

    // Log the failover event
    logFailoverEvent({
      originalSlug: slug,
      fallbackSlug: fallback.slug,
      consumerId,
      costCents: actualCost,
      originalStatus,
      fallbackStatus,
      latencyMs,
      requestId,
    })

    // Build response with failover headers
    const responseHeaders = new Headers()
    fallbackResponse.headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (lower !== 'transfer-encoding' && lower !== 'connection') {
        responseHeaders.set(key, value)
      }
    })

    responseHeaders.set('X-SettleGrid-Proxy', 'true')
    responseHeaders.set('X-SettleGrid-Cost-Cents', String(actualCost))
    responseHeaders.set('X-SettleGrid-Latency-Ms', String(latencyMs))
    responseHeaders.set('X-Powered-By', 'SettleGrid (settlegrid.ai)')
    responseHeaders.set('X-SettleGrid-Tool', slug)
    responseHeaders.set('X-SettleGrid-Protocol', 'api-key')
    responseHeaders.set('X-SettleGrid-Cache', 'MISS')
    addFailoverHeaders(responseHeaders, fallback.slug)
    if (requestId) responseHeaders.set('x-request-id', requestId)

    // Return the fallback response
    return injectAttributionAndReturn(
      fallbackResponse, responseHeaders, fallbackStatus, slug, actualCost, 'api-key'
    )
  } catch (err) {
    logger.error('proxy.failover_error', {
      slug,
      category,
      consumerId,
      error: err instanceof Error ? err.message : String(err),
      requestId,
    })
    return null
  }
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
