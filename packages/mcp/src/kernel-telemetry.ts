/**
 * P5.K1 — Kernel telemetry: events, sanitizer, emitter.
 *
 * The cross-protocol kernel emits structured telemetry at five
 * lifecycle points so production traffic is observable without the
 * developer hand-instrumenting anything. Telemetry is fire-and-forget:
 * emission failures NEVER block dispatch, NEVER throw out of
 * `kernel.handle()`, and NEVER mutate the response.
 *
 * Five event types (per spec §P5.K1):
 *   - `kernel.request_received`     — every accepted invocation
 *   - `kernel.routing_decision`     — once a rail is chosen
 *   - `kernel.adapter_latency_ms`   — every adapter round-trip
 *   - `kernel.adapter_error`        — every adapter failure
 *   - `kernel.invocation_settled`   — successful settlement only
 *
 * # Architecture
 *
 * Same proxy pattern as P4.1 SDK telemetry (`telemetry.ts`): the SDK
 * MUST NOT carry the PostHog API key. Events POST to
 * `${apiUrl}/api/telemetry/kernel`, which validates + persists to the
 * local `kernel_telemetry` table AND forwards to PostHog using the
 * server-side key. This keeps the dashboard
 * working when PostHog is unreachable (the table is the source of
 * truth) and keeps the public key surface small (the SDK tarball
 * still has zero secrets).
 *
 * # PII discipline
 *
 *   - Free-text fields (`error_message`, `reason`) → `sanitizeFreeText`
 *     truncates, strips control characters, and refuses anything that
 *     looks email/URL/digit-run shaped — defends against an adapter
 *     accidentally throwing an Error whose `.message` includes a
 *     customer's request body or email.
 *   - Numeric fields → `sanitizeNonNegNumber` clamps to non-negative
 *     finite range, so a buggy adapter can't poison aggregates.
 *   - Identifiers (adapter, protocol, currency, rail, error_class) →
 *     `sanitizeEnumLike` restricts to a kebab/dot/underscore class.
 *   - `dev_id` is the developer's internal UUID — explicitly allowed
 *     by the spec; never an email.
 *
 * # Hostile invariants
 *
 *   - Never throws into product code.
 *   - Respects `SETTLEGRID_TELEMETRY=0`, same env var as P4.1.
 *   - 2-second per-emit timeout via AbortController.
 *   - Sanitization happens in this module before anything is POSTed
 *     so a downstream proxy bug can't bypass it.
 *
 * @packageDocumentation
 */

const DEFAULT_PROXY_BASE = 'https://settlegrid.ai'
const KERNEL_TELEMETRY_TIMEOUT_MS = 2000
const KERNEL_TELEMETRY_PATH = '/api/telemetry/kernel'

// ─── Event names ───────────────────────────────────────────────────────────

/**
 * Frozen tuple of allowed kernel event names. Kept separate from the
 * funnel-event tuple in apps/web's `posthog.ts` because:
 *
 *   - Funnel events are user-action tracking from the gallery / CLI;
 *     consumers want a tight union.
 *   - Kernel events are server-side operational observability; the
 *     two domains don't share a consumer.
 *
 * Type-checked via `isKernelEventName` so a typo'd event name
 * collapses at compile time, not at the proxy ingestion layer.
 */
export const KERNEL_EVENT_NAMES = Object.freeze([
  'kernel.request_received',
  'kernel.routing_decision',
  'kernel.adapter_latency_ms',
  'kernel.adapter_error',
  'kernel.invocation_settled',
] as const)

export type KernelEventName = (typeof KERNEL_EVENT_NAMES)[number]

export function isKernelEventName(name: string): name is KernelEventName {
  return (KERNEL_EVENT_NAMES as readonly string[]).includes(name)
}

// ─── Event property types ──────────────────────────────────────────────────

export interface KernelRequestReceivedProps {
  adapter: string
  protocol: string
  currency: string
  amountCents: number
  devId: string | null
}

export interface KernelRoutingDecisionProps {
  adapter: string
  rail: string
  reason: string
  alternativesConsidered: string[]
  feeBps: number
}

export interface KernelAdapterLatencyProps {
  adapter: string
  latencyMs: number
  success: boolean
}

export interface KernelAdapterErrorProps {
  adapter: string
  errorClass: string
  errorMessage: string
}

export interface KernelInvocationSettledProps {
  adapter: string
  rail: string
  amountCents: number
  takeCents: number
  latencyMs: number
}

export type KernelTelemetryEvent =
  | { name: 'kernel.request_received'; props: KernelRequestReceivedProps }
  | { name: 'kernel.routing_decision'; props: KernelRoutingDecisionProps }
  | { name: 'kernel.adapter_latency_ms'; props: KernelAdapterLatencyProps }
  | { name: 'kernel.adapter_error'; props: KernelAdapterErrorProps }
  | { name: 'kernel.invocation_settled'; props: KernelInvocationSettledProps }

// ─── Sanitization ──────────────────────────────────────────────────────────

const FREE_TEXT_MAX_LEN = 200
const ENUM_LIKE_MAX_LEN = 64
const ENUM_LIKE_RE = /^[a-z0-9][a-z0-9._-]*$/i
const PII_SHAPED_RE = /@|:\/\/|\d{6,}/

/**
 * Strip ASCII control characters EXCEPT \r and \n (which we use for
 * line splitting before stripping).
 */
function stripControlCharsExceptNewlines(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/[\x00-\x09\x0b\x0c\x0e-\x1f\x7f]/g, '')
}

/**
 * Truncate to FREE_TEXT_MAX_LEN, strip control characters, refuse
 * anything that looks PII-shaped. Returns `'[redacted]'` (not `''`)
 * for refused input so the dashboard can count redactions — a sudden
 * spike in `[redacted]` flags an upstream sanitization regression.
 *
 * Order: split on newlines FIRST so we keep only the first line,
 * THEN strip remaining control chars + apply length cap. Reversing
 * the order would collapse multi-line input into one long string
 * that defeats the first-line policy.
 */
export function sanitizeFreeText(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (trimmed.length === 0) return ''
  const firstLine = stripControlCharsExceptNewlines(
    trimmed.split(/\r?\n/, 1)[0],
  ).trim()
  if (firstLine.length === 0) return ''
  if (PII_SHAPED_RE.test(firstLine)) return '[redacted]'
  return firstLine.length > FREE_TEXT_MAX_LEN
    ? firstLine.slice(0, FREE_TEXT_MAX_LEN - 1) + '…'
    : firstLine
}

/** Restrict to enum-like character class. Returns `''` for refused input. */
export function sanitizeEnumLike(input: unknown): string {
  if (typeof input !== 'string') return ''
  const trimmed = input.trim()
  if (trimmed.length === 0 || trimmed.length > ENUM_LIKE_MAX_LEN) return ''
  if (!ENUM_LIKE_RE.test(trimmed)) return ''
  return trimmed
}

/** UUID-shaped or null. dev_id is internal UUID per spec. */
export function sanitizeDevId(input: unknown): string | null {
  if (input === null || input === undefined) return null
  if (typeof input !== 'string') return null
  const UUID_RE =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return UUID_RE.test(input) ? input.toLowerCase() : null
}

/** Coerce to a non-negative finite number; collapse junk to 0. */
export function sanitizeNonNegNumber(input: unknown): number {
  if (typeof input === 'number' && Number.isFinite(input) && input >= 0) {
    return input
  }
  if (typeof input === 'string') {
    const n = Number(input)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }
  return 0
}

function sanitizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  const out: string[] = []
  for (const item of input) {
    const safe = sanitizeEnumLike(item)
    if (safe) out.push(safe)
  }
  return out
}

/** Whole-event sanitizer — every sink receives a guaranteed clean payload. */
export function sanitizeEvent(event: KernelTelemetryEvent): KernelTelemetryEvent {
  switch (event.name) {
    case 'kernel.request_received':
      return {
        name: event.name,
        props: {
          adapter: sanitizeEnumLike(event.props.adapter),
          protocol: sanitizeEnumLike(event.props.protocol),
          currency: sanitizeEnumLike(event.props.currency),
          amountCents: sanitizeNonNegNumber(event.props.amountCents),
          devId: sanitizeDevId(event.props.devId),
        },
      }
    case 'kernel.routing_decision':
      return {
        name: event.name,
        props: {
          adapter: sanitizeEnumLike(event.props.adapter),
          rail: sanitizeEnumLike(event.props.rail),
          reason: sanitizeFreeText(event.props.reason),
          alternativesConsidered: sanitizeStringList(
            event.props.alternativesConsidered,
          ),
          feeBps: sanitizeNonNegNumber(event.props.feeBps),
        },
      }
    case 'kernel.adapter_latency_ms':
      return {
        name: event.name,
        props: {
          adapter: sanitizeEnumLike(event.props.adapter),
          latencyMs: sanitizeNonNegNumber(event.props.latencyMs),
          success: Boolean(event.props.success),
        },
      }
    case 'kernel.adapter_error':
      return {
        name: event.name,
        props: {
          adapter: sanitizeEnumLike(event.props.adapter),
          errorClass: sanitizeEnumLike(event.props.errorClass),
          errorMessage: sanitizeFreeText(event.props.errorMessage),
        },
      }
    case 'kernel.invocation_settled':
      return {
        name: event.name,
        props: {
          adapter: sanitizeEnumLike(event.props.adapter),
          rail: sanitizeEnumLike(event.props.rail),
          amountCents: sanitizeNonNegNumber(event.props.amountCents),
          takeCents: sanitizeNonNegNumber(event.props.takeCents),
          latencyMs: sanitizeNonNegNumber(event.props.latencyMs),
        },
      }
  }
}

// ─── Opt-out (mirrors P4.1 telemetry.ts) ───────────────────────────────────

export function isKernelTelemetryOptedOut(): boolean {
  const env =
    typeof process !== 'undefined' && process.env ? process.env : undefined
  const raw = env?.SETTLEGRID_TELEMETRY?.trim().toLowerCase()
  if (!raw) return false
  return raw === '0' || raw === 'false' || raw === 'no' || raw === 'off'
}

// ─── Emitter ───────────────────────────────────────────────────────────────

/** Sync emit surface used by the kernel. Fire-and-forget. */
export interface KernelTelemetryEmitter {
  emit(event: KernelTelemetryEvent): void
}

/** Test hook: inject a mock fetch. */
let fetchOverride: typeof fetch | undefined

/** @internal */
export function __setKernelFetchForTests(impl: typeof fetch | undefined): void {
  fetchOverride = impl
}

interface ProxyBody {
  name: KernelEventName
  props: KernelTelemetryEvent['props']
  ts: string
}

async function postToProxy(apiUrl: string, body: ProxyBody): Promise<boolean> {
  const fetchImpl = fetchOverride ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return false

  const base = (apiUrl || DEFAULT_PROXY_BASE).replace(/\/$/, '')
  const url = `${base}${KERNEL_TELEMETRY_PATH}`

  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    KERNEL_TELEMETRY_TIMEOUT_MS,
  )

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export interface CreateKernelEmitterOptions {
  /** Base URL of the SettleGrid API. Defaults to https://settlegrid.ai. */
  apiUrl?: string
}

/**
 * Default emitter — POSTs sanitized events to the proxy. Wraps the
 * whole flow in try/catch so a synchronous failure (e.g. JSON.stringify
 * throwing on a circular reference some adapter accidentally produced)
 * cannot escape into the kernel.
 *
 * Returns a no-op emitter when `SETTLEGRID_TELEMETRY=0`. Caller can
 * always supply a custom emitter (e.g. for tests).
 */
export function createKernelEmitter(
  opts: CreateKernelEmitterOptions = {},
): KernelTelemetryEmitter {
  const apiUrl = opts.apiUrl ?? DEFAULT_PROXY_BASE
  if (isKernelTelemetryOptedOut()) {
    return noopKernelEmitter()
  }
  return {
    emit(event: KernelTelemetryEvent): void {
      try {
        const sanitized = sanitizeEvent(event)
        const body: ProxyBody = {
          name: sanitized.name,
          props: sanitized.props,
          ts: new Date().toISOString(),
        }
        // Fire-and-forget; promise rejection silently swallowed.
        void postToProxy(apiUrl, body).catch(() => {
          /* fire-and-forget */
        })
      } catch {
        /* never throws into kernel */
      }
    },
  }
}

/** No-op emitter — for tests / opt-out. */
export function noopKernelEmitter(): KernelTelemetryEmitter {
  return { emit: () => {} }
}

/**
 * In-memory emitter for tests. Events accumulate in `.events`;
 * `.clear()` between assertions. NOT for production — unbounded.
 */
export interface MemoryKernelEmitter extends KernelTelemetryEmitter {
  readonly events: KernelTelemetryEvent[]
  clear(): void
}

export function memoryKernelEmitter(): MemoryKernelEmitter {
  const events: KernelTelemetryEvent[] = []
  return {
    events,
    clear() {
      events.length = 0
    },
    emit(event) {
      try {
        events.push(sanitizeEvent(event))
      } catch {
        /* never throws */
      }
    },
  }
}
