/**
 * P3.K6 — Pre-execution authorization gate.
 *
 * Unifies OFAC sanctions screening, AUP enforcement, fraud scoring,
 * budget enforcement, and rate limiting into a single
 * `authorizeInvocation(ctx, config)` function that the kernel dispatch
 * chain calls between "verify payment" and "execute tool". Defines an
 * `AuthorizationPlugin` interface for optional third-party
 * authorization engines (enterprise policy layers, regulated-industry
 * compliance gates) that developers register per-tool via the kernel
 * config.
 *
 * ## Check order (D1 deviation from card spec order)
 *
 * The P3.K6 card lists check order as:
 *   1. rate limit → 2. budget → 3. fraud → 4. OFAC → 5. AUP
 * with short-circuit on first deny. Hostile-review requirement (a)
 * states: "the OFAC check actually runs on every invocation, not
 * just flagged ones — strict liability requires universal
 * screening." Short-circuiting rate/budget/fraud BEFORE OFAC would
 * violate (a) — a rate-limited consumer who is also on the SDN list
 * would escape the screening log entirely.
 *
 * The implementation runs **OFAC first**, then rate → budget → fraud
 * → AUP. Short-circuit still applies (first deny stops the chain),
 * but OFAC is guaranteed to run. The `signals` array records which
 * checks ran + their verdicts; reconciliation + compliance audits
 * read from the unified ledger (recordLedgerEntry with
 * authorizationSignals) rather than from the gate function's
 * in-memory state.
 *
 * ## Dependency injection (D4)
 *
 * `fraud.ts` / `rate-limit.ts` / OFAC cache / AUP rules all live in
 * `apps/web/src/lib/` — `@settlegrid/mcp` cannot import from the
 * Next.js app. The gate accepts each check as an injectable function
 * via `AuthorizationConfig`. Defaults are silent no-op allow; real
 * impls wire up at kernel-construction time from apps/web.
 *
 * ## Plugin contract
 *
 *   - Plugins run AFTER all built-in checks pass. A built-in deny
 *     short-circuits before any plugin runs.
 *   - Plugin timeout (default 500ms) fails CLOSED — plugin-timed-out
 *     invocations are denied, never allowed. Hostile-review
 *     requirement (b).
 *   - Plugins that throw are treated identically to a deny result
 *     (fail closed). The throw is logged via `config.logger` when
 *     provided.
 *   - Plugins run in registration order. First plugin to deny stops
 *     the chain — subsequent plugins do not run.
 *   - Plugin's optional `artifact` (e.g., a signed authorization
 *     token) is captured on the result and propagates to the ledger
 *     entry via `authorizationArtifact`.
 */

import type { MeterContext } from './types'

// ─── Public types ────────────────────────────────────────────────────

/**
 * One signal entry in the authorization result. Describes which
 * check ran, its verdict, and an optional detail string for audit
 * logs. Per hostile-review requirement (e), the external 403
 * response exposes only the top-level `reason` — the signals
 * array stays internal (written to the ledger for compliance
 * audit but NEVER leaked to the caller in the HTTP body).
 */
export interface AuthorizationSignal {
  check: string
  passed: boolean
  detail?: string
}

/** Outcome returned by `authorizeInvocation`. */
export interface AuthorizationResult {
  allowed: boolean
  /** Top-level reason when `allowed === false`. Safe to return to caller. */
  reason?: string
  /** Per-check verdicts. Internal — do NOT expose on the HTTP response. */
  signals: AuthorizationSignal[]
  /** Optional cryptographic artifact returned by a plugin. */
  artifact?: string
  /** Full gate duration in milliseconds (for latency monitoring). */
  durationMs: number
}

/**
 * External authorization engine. Plugins run after all built-in
 * checks pass. A plugin that denies blocks the invocation. A
 * plugin that returns an artifact has it recorded on the ledger.
 */
export interface AuthorizationPlugin {
  readonly name: string
  authorize(
    ctx: AuthorizationContext,
  ): Promise<{
    allowed: boolean
    reason?: string
    artifact?: string
  }>
}

/**
 * Context passed to the gate. Extends MeterContext with the
 * supplementary fields the checks need (developer + consumer IDs
 * for OFAC, toolSlug + method + category for AUP, costCents + ip +
 * keyId for fraud). All fields are optional — the gate makes
 * best-effort screening decisions with what the caller provides.
 */
export interface AuthorizationContext extends MeterContext {
  developerId?: string
  consumerId?: string
  toolSlug?: string
  toolCategory?: string
  method?: string
  costCents?: number
  ip?: string
  keyId?: string
}

// ─── Injectable check primitive types ────────────────────────────────

export interface RateLimitOutcome {
  allowed: boolean
  reason?: string
  detail?: string
}
export type RateLimitCheck = (
  ctx: AuthorizationContext,
) => Promise<RateLimitOutcome>

export interface BudgetOutcome {
  allowed: boolean
  reason?: string
  detail?: string
}
export type BudgetCheck = (ctx: AuthorizationContext) => Promise<BudgetOutcome>

export interface FraudOutcome {
  /** 0-100 risk score. Higher = more fraudulent. */
  riskScore: number
  reasons?: readonly string[]
}
export type FraudCheck = (ctx: AuthorizationContext) => Promise<FraudOutcome>

export interface OfacOutcome {
  /**
   * True iff the developer or consumer is on the SDN list.
   * `matchedParty` names WHICH id matched — audit-trail evidence.
   */
  listed: boolean
  matchedParty?: string
  detail?: string
}
export type OfacCheck = (ctx: AuthorizationContext) => Promise<OfacOutcome>

export interface AupOutcome {
  allowed: boolean
  reason?: string
  detail?: string
}
export type AupCheck = (
  ctx: AuthorizationContext,
) => AupOutcome | Promise<AupOutcome>

// ─── Config ──────────────────────────────────────────────────────────

export interface AuthorizationLogger {
  info: (event: string, data?: Record<string, unknown>) => void
  warn: (event: string, data?: Record<string, unknown>) => void
  error: (event: string, data?: Record<string, unknown>, err?: unknown) => void
}

export interface AuthorizationConfig {
  plugins?: readonly AuthorizationPlugin[]
  rateLimiter?: RateLimitCheck
  budgetChecker?: BudgetCheck
  fraudScorer?: FraudCheck
  ofacScreener?: OfacCheck
  aupEnforcer?: AupCheck
  /** Risk score threshold (0-100) above which fraud check denies. */
  fraudDenyThreshold?: number
  /** Plugin execution timeout in ms. Fails CLOSED on timeout. */
  pluginTimeoutMs?: number
  /** Clock override for deterministic tests. Returns milliseconds. */
  clock?: () => number
  /** Optional logger. Defaults to silent. */
  logger?: AuthorizationLogger
}

// ─── Constants ───────────────────────────────────────────────────────

/** Default fraud deny threshold (0-100 scale per apps/web/src/lib/fraud.ts). */
export const DEFAULT_FRAUD_DENY_THRESHOLD = 80

/** Default plugin timeout (ms) — hostile req (b) fails CLOSED on timeout. */
export const DEFAULT_PLUGIN_TIMEOUT_MS = 500

/** Default no-op fail-closed timeout minimum (ms). Values below this
 *  are clamped up to prevent races under clock-drift or a 0ms
 *  misconfiguration that would treat every plugin as timed out. */
const MIN_PLUGIN_TIMEOUT_MS = 10

/** No-op logger used as the default. */
const NOOP_LOGGER: AuthorizationLogger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
}

// ─── Public function ─────────────────────────────────────────────────

/**
 * Run the pre-execution authorization gate. Returns an
 * `AuthorizationResult` with:
 *   - `allowed: boolean` — overall verdict
 *   - `reason?: string` — single human-readable denial reason
 *   - `signals: AuthorizationSignal[]` — per-check audit trail
 *   - `artifact?: string` — optional plugin-returned token
 *   - `durationMs: number` — full gate duration
 *
 * Never throws. All internal errors are captured into signals with
 * `passed: false` and mapped to a deny outcome.
 */
export async function authorizeInvocation(
  ctx: AuthorizationContext,
  config: AuthorizationConfig = {},
): Promise<AuthorizationResult> {
  const clock = config.clock ?? Date.now
  const logger = config.logger ?? NOOP_LOGGER
  const startTime = clock()
  const signals: AuthorizationSignal[] = []

  // Validate basic input.
  if (ctx === null || typeof ctx !== 'object') {
    return {
      allowed: false,
      reason: 'authorization_context_required',
      signals: [],
      durationMs: 0,
    }
  }

  // ── Step 1: OFAC (runs first per hostile req (a) — strict liability) ──
  const ofacSignal = await runOfac(ctx, config, logger)
  signals.push(ofacSignal)
  if (!ofacSignal.passed) {
    return {
      allowed: false,
      reason: ofacSignal.detail ?? 'ofac_denied',
      signals,
      durationMs: clock() - startTime,
    }
  }

  // ── Step 2: Rate limit ──
  const rateSignal = await runRateLimit(ctx, config, logger)
  signals.push(rateSignal)
  if (!rateSignal.passed) {
    return {
      allowed: false,
      reason: rateSignal.detail ?? 'rate_limited',
      signals,
      durationMs: clock() - startTime,
    }
  }

  // ── Step 3: Budget ──
  const budgetSignal = await runBudget(ctx, config, logger)
  signals.push(budgetSignal)
  if (!budgetSignal.passed) {
    return {
      allowed: false,
      reason: budgetSignal.detail ?? 'budget_exceeded',
      signals,
      durationMs: clock() - startTime,
    }
  }

  // ── Step 4: Fraud score ──
  const fraudSignal = await runFraud(ctx, config, logger)
  signals.push(fraudSignal)
  if (!fraudSignal.passed) {
    return {
      allowed: false,
      reason: fraudSignal.detail ?? 'fraud_threshold_exceeded',
      signals,
      durationMs: clock() - startTime,
    }
  }

  // ── Step 5: AUP ──
  const aupSignal = await runAup(ctx, config, logger)
  signals.push(aupSignal)
  if (!aupSignal.passed) {
    return {
      allowed: false,
      reason: aupSignal.detail ?? 'aup_violation',
      signals,
      durationMs: clock() - startTime,
    }
  }

  // ── Step 6: Plugins (only after all built-ins pass) ──
  const plugins = config.plugins ?? []
  const pluginTimeoutMs = Math.max(
    MIN_PLUGIN_TIMEOUT_MS,
    config.pluginTimeoutMs ?? DEFAULT_PLUGIN_TIMEOUT_MS,
  )
  let artifact: string | undefined
  for (const plugin of plugins) {
    const pluginSignal = await runPluginWithTimeout(
      plugin,
      ctx,
      pluginTimeoutMs,
      logger,
    )
    signals.push(pluginSignal.signal)
    if (!pluginSignal.signal.passed) {
      return {
        allowed: false,
        reason: pluginSignal.signal.detail ?? `plugin_denied:${plugin.name}`,
        signals,
        durationMs: clock() - startTime,
      }
    }
    if (pluginSignal.artifact !== undefined) {
      artifact = pluginSignal.artifact
    }
  }

  return {
    allowed: true,
    signals,
    ...(artifact !== undefined ? { artifact } : {}),
    durationMs: clock() - startTime,
  }
}

// ─── Internal check runners ──────────────────────────────────────────

async function runOfac(
  ctx: AuthorizationContext,
  config: AuthorizationConfig,
  logger: AuthorizationLogger,
): Promise<AuthorizationSignal> {
  const screener = config.ofacScreener
  if (screener === undefined) {
    // Silent no-op default. Operators MUST wire a real screener in
    // production — strict-liability frameworks (OFAC 50 Percent
    // Rule, CAATSA) require demonstrable screening. The gate logs
    // a warning once per authorize call so observability surfaces
    // the gap without spamming.
    logger.warn('authorize.ofac_not_wired', {
      hint: 'supply config.ofacScreener in production deployments',
    })
    return { check: 'ofac', passed: true, detail: 'screener_not_wired' }
  }
  try {
    const outcome = await screener(ctx)
    // Per strict-liability requirement: log EVERY OFAC check's
    // outcome, whether listed or not. A populated screening log is
    // evidence the program ran.
    logger.info('authorize.ofac_screened', {
      listed: outcome.listed,
      matchedParty: outcome.matchedParty ?? null,
    })
    if (outcome.listed) {
      return {
        check: 'ofac',
        passed: false,
        detail: `ofac_listed:${outcome.matchedParty ?? 'party_matched'}`,
      }
    }
    return { check: 'ofac', passed: true, detail: outcome.detail }
  } catch (err) {
    logger.error('authorize.ofac_failed', {}, err)
    return {
      check: 'ofac',
      passed: false,
      detail: 'ofac_error',
    }
  }
}

async function runRateLimit(
  ctx: AuthorizationContext,
  config: AuthorizationConfig,
  logger: AuthorizationLogger,
): Promise<AuthorizationSignal> {
  const limiter = config.rateLimiter
  if (limiter === undefined) {
    return { check: 'rate_limit', passed: true, detail: 'limiter_not_wired' }
  }
  try {
    const outcome = await limiter(ctx)
    return {
      check: 'rate_limit',
      passed: outcome.allowed,
      detail: outcome.allowed ? outcome.detail : (outcome.reason ?? 'rate_limited'),
    }
  } catch (err) {
    logger.error('authorize.rate_limit_failed', {}, err)
    // Fail CLOSED on rate-limiter error — a broken rate limiter
    // would otherwise let every invocation through.
    return { check: 'rate_limit', passed: false, detail: 'rate_limit_error' }
  }
}

async function runBudget(
  ctx: AuthorizationContext,
  config: AuthorizationConfig,
  logger: AuthorizationLogger,
): Promise<AuthorizationSignal> {
  const checker = config.budgetChecker
  if (checker === undefined) {
    return { check: 'budget', passed: true, detail: 'checker_not_wired' }
  }
  try {
    const outcome = await checker(ctx)
    return {
      check: 'budget',
      passed: outcome.allowed,
      detail: outcome.allowed ? outcome.detail : (outcome.reason ?? 'budget_exceeded'),
    }
  } catch (err) {
    logger.error('authorize.budget_failed', {}, err)
    return { check: 'budget', passed: false, detail: 'budget_error' }
  }
}

async function runFraud(
  ctx: AuthorizationContext,
  config: AuthorizationConfig,
  logger: AuthorizationLogger,
): Promise<AuthorizationSignal> {
  const scorer = config.fraudScorer
  if (scorer === undefined) {
    return { check: 'fraud', passed: true, detail: 'scorer_not_wired' }
  }
  const threshold = config.fraudDenyThreshold ?? DEFAULT_FRAUD_DENY_THRESHOLD
  try {
    const outcome = await scorer(ctx)
    if (
      typeof outcome.riskScore !== 'number' ||
      !Number.isFinite(outcome.riskScore) ||
      outcome.riskScore < 0
    ) {
      logger.warn('authorize.fraud_invalid_score', {
        riskScore: outcome.riskScore,
      })
      return { check: 'fraud', passed: false, detail: 'fraud_invalid_score' }
    }
    if (outcome.riskScore >= threshold) {
      const reasons = outcome.reasons && outcome.reasons.length > 0
        ? outcome.reasons.join(',')
        : 'threshold_exceeded'
      return {
        check: 'fraud',
        passed: false,
        detail: `fraud_score=${outcome.riskScore};reasons=${reasons}`,
      }
    }
    return { check: 'fraud', passed: true, detail: `fraud_score=${outcome.riskScore}` }
  } catch (err) {
    logger.error('authorize.fraud_failed', {}, err)
    return { check: 'fraud', passed: false, detail: 'fraud_error' }
  }
}

async function runAup(
  ctx: AuthorizationContext,
  config: AuthorizationConfig,
  logger: AuthorizationLogger,
): Promise<AuthorizationSignal> {
  const enforcer = config.aupEnforcer
  if (enforcer === undefined) {
    return { check: 'aup', passed: true, detail: 'enforcer_not_wired' }
  }
  try {
    const outcome = await enforcer(ctx)
    return {
      check: 'aup',
      passed: outcome.allowed,
      detail: outcome.allowed ? outcome.detail : (outcome.reason ?? 'aup_violation'),
    }
  } catch (err) {
    logger.error('authorize.aup_failed', {}, err)
    return { check: 'aup', passed: false, detail: 'aup_error' }
  }
}

interface PluginRunOutcome {
  signal: AuthorizationSignal
  artifact?: string
}

/**
 * Run a plugin with a hard timeout. On timeout, throw, or deny
 * result, returns `passed: false`. Hostile-review requirement (b):
 * fails CLOSED — there is no configuration under which a plugin
 * timeout results in `allowed: true`.
 */
async function runPluginWithTimeout(
  plugin: AuthorizationPlugin,
  ctx: AuthorizationContext,
  timeoutMs: number,
  logger: AuthorizationLogger,
): Promise<PluginRunOutcome> {
  const pluginName = typeof plugin.name === 'string' && plugin.name.length > 0
    ? plugin.name
    : 'unnamed'
  // Validate the plugin has an authorize function. A caller who
  // passes a malformed plugin object (wrong shape, typo) should see
  // a clean deny rather than a TypeError.
  if (typeof plugin.authorize !== 'function') {
    logger.error('authorize.plugin_malformed', { name: pluginName })
    return {
      signal: {
        check: `plugin:${pluginName}`,
        passed: false,
        detail: 'plugin_malformed',
      },
    }
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error('plugin_timeout'))
    }, timeoutMs)
  })

  try {
    const result = await Promise.race([plugin.authorize(ctx), timeoutPromise])
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    if (result === null || typeof result !== 'object') {
      logger.warn('authorize.plugin_returned_non_object', { name: pluginName })
      return {
        signal: {
          check: `plugin:${pluginName}`,
          passed: false,
          detail: 'plugin_invalid_result',
        },
      }
    }
    return {
      signal: {
        check: `plugin:${pluginName}`,
        passed: Boolean(result.allowed),
        detail: result.allowed
          ? undefined
          : (result.reason ?? `plugin_denied:${pluginName}`),
      },
      ...(result.artifact !== undefined &&
      typeof result.artifact === 'string' &&
      result.artifact.length > 0
        ? { artifact: result.artifact }
        : {}),
    }
  } catch (err) {
    if (timeoutHandle !== undefined) clearTimeout(timeoutHandle)
    const isTimeout = err instanceof Error && err.message === 'plugin_timeout'
    logger.error(
      isTimeout ? 'authorize.plugin_timeout' : 'authorize.plugin_threw',
      { name: pluginName, timeoutMs },
      err,
    )
    return {
      signal: {
        check: `plugin:${pluginName}`,
        passed: false,
        detail: isTimeout ? 'plugin_timeout' : 'plugin_error',
      },
    }
  }
}
