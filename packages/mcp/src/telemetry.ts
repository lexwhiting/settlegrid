/**
 * P4.1 — SDK telemetry.
 *
 * Spec deviation note (P4.1 Round 2 may flag): the master plan's
 * "Relevant file paths" list includes `packages/mcp/src/sdk.ts`, but
 * that file does not exist in the codebase — the SDK entry point is
 * `index.ts` (which re-exports `settlegrid.init`) and the runtime
 * pipeline lives in `middleware.ts`. We park telemetry in this new
 * `telemetry.ts` and wire it into both `index.ts` (sdk_first_init)
 * and the meter pipeline (first_billed_call) without inventing an
 * `sdk.ts` file. This is the same lesson Phase 3 hit at P3.13:
 * "Spec text can be wrong about package names — grep package.json
 * to verify before using a name from a spec."
 *
 * Two events:
 *   - `sdk_first_init` — fires once per process per toolSlug, when
 *     `settlegrid.init()` completes. distinct_id = sha256(toolSlug).
 *   - `first_billed_call` — fires once per process per
 *     (toolSlug, consumerId), after the first successful `meter()`.
 *     distinct_id = sha256(toolSlug). This is the conversion event
 *     for the Phase 5 funnel.
 *
 * The SDK ships in `@settlegrid/mcp` to consumers' tool servers. It
 * MUST NEVER include a PostHog API key — POSTs go to the proxy at
 * `${config.apiUrl}/api/telemetry/capture` (default
 * `https://settlegrid.ai`). The proxy server-side enriches +
 * forwards to PostHog with the project key.
 *
 * ## Hostile invariants
 *
 *   - Never throws into product code. `meter()` errors stay
 *     unaffected; telemetry fire-and-forget.
 *   - Respects `SETTLEGRID_TELEMETRY=0` (same env var as the CLI),
 *     case-insensitive + whitespace-tolerant.
 *   - 2-second timeout via AbortController.
 *   - SHA-256 via `@noble/hashes/sha256` (already a SDK dep, works
 *     in Node and browsers — the SDK is multi-runtime).
 *
 * @packageDocumentation
 */
import { sha256 } from '@noble/hashes/sha256'

const DEFAULT_PROXY_BASE = 'https://settlegrid.ai'
const TELEMETRY_TIMEOUT_MS = 2000

export type SdkEventName = 'sdk_first_init' | 'first_billed_call'

// ─── Opt-out ────────────────────────────────────────────────────────────────

/**
 * Read the SETTLEGRID_TELEMETRY env var. Same semantics as the CLI:
 * '0' / 'false' / 'no' / 'off' → opted out, anything else → on.
 *
 * In a non-Node environment (browser SDK consumers) `process` may
 * be undefined; we fall back to "on" (telemetry attempted) and let
 * the network call fail closed if the proxy isn't reachable.
 */
export function isSdkTelemetryOptedOut(): boolean {
  // Some bundlers replace `process` with `undefined` in browser
  // builds. Guard the access.
  const env =
    typeof process !== 'undefined' && process.env ? process.env : undefined
  const raw = env?.SETTLEGRID_TELEMETRY?.trim().toLowerCase()
  if (!raw) return false
  return raw === '0' || raw === 'false' || raw === 'no' || raw === 'off'
}

// ─── Hashing ────────────────────────────────────────────────────────────────

/**
 * SHA-256 of the toolSlug as the SDK's stable, anonymous distinct_id.
 * Hex-encoded so PostHog displays it as a readable string.
 *
 * Note: `sha256` from `@noble/hashes/sha256` returns a Uint8Array.
 * We convert to lowercase hex.
 */
export function hashOrgId(toolSlug: string): string {
  const bytes = sha256(new TextEncoder().encode(toolSlug))
  let out = ''
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, '0')
  }
  return out
}

// ─── Per-process dedupe sets ────────────────────────────────────────────────

/**
 * Set of toolSlugs that have already fired `sdk_first_init` in this
 * process. The spec says "first init() per org" — toolSlug is the
 * only identifier the SDK knows at init() time, and each tool
 * belongs to exactly one org, so per-toolSlug dedupe satisfies the
 * spec without an extra network call.
 */
const initFiredFor = new Set<string>()

/**
 * Set of `${toolSlug}::${consumerId}` strings that have already
 * fired `first_billed_call`. The spec says "first successful billed
 * invocation" — we interpret "first" as per (toolSlug, consumerId)
 * pair so a tool that bills 100 different consumers fires 100 times
 * (correct: each is a new "first invocation" for that consumer).
 *
 * Bounded growth: capped at 10K entries. If a tool somehow handles
 * 10K unique consumers in a single process, the dedupe degrades
 * gracefully (events fire again for evicted entries) — preferable
 * to unbounded heap growth.
 */
const FIRST_BILLED_MAX_ENTRIES = 10_000
const firstBilledFiredFor = new Set<string>()

/** @internal Test hook — clear dedupe state between tests. */
export function __resetSdkTelemetryForTests(): void {
  initFiredFor.clear()
  firstBilledFiredFor.clear()
  fetchOverride = undefined
}

let fetchOverride: typeof fetch | undefined

/** @internal Test hook — inject a mock fetch. */
export function __setSdkFetchForTests(impl: typeof fetch | undefined): void {
  fetchOverride = impl
}

// ─── Capture helpers ────────────────────────────────────────────────────────

interface CaptureBody {
  event: SdkEventName
  properties: Record<string, unknown>
  distinct_id: string
}

async function postToProxy(
  apiUrl: string,
  body: CaptureBody,
): Promise<boolean> {
  const fetchImpl = fetchOverride ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') return false

  const base = (apiUrl || DEFAULT_PROXY_BASE).replace(/\/$/, '')
  const url = `${base}/api/telemetry/capture`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS)

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

/**
 * Fire `sdk_first_init` if not yet fired in this process for this
 * toolSlug. Fire-and-forget — the returned promise can be safely
 * ignored. Returns `false` synchronously when deduped or opted out;
 * returns the eventual proxy result otherwise.
 *
 * Hostile-review fix (H4): the entire body is wrapped so a
 * synchronous throw (e.g., null/undefined toolSlug → TextEncoder
 * rejecting in hashOrgId) cannot propagate up through `init()` and
 * become a regression of "telemetry never throws into product
 * code." The fetch path inside `postToProxy` is already
 * try/catch-protected; this guards the pre-fetch arithmetic.
 */
export function emitSdkFirstInit(args: {
  toolSlug: string
  apiUrl: string
  sdkVersion: string
}): Promise<boolean> {
  try {
    if (isSdkTelemetryOptedOut()) return Promise.resolve(false)
    if (initFiredFor.has(args.toolSlug)) return Promise.resolve(false)
    initFiredFor.add(args.toolSlug)

    const orgIdHash = hashOrgId(args.toolSlug)
    return postToProxy(args.apiUrl, {
      event: 'sdk_first_init',
      properties: {
        sdk_version: args.sdkVersion,
        org_id_hash: orgIdHash,
      },
      distinct_id: orgIdHash,
    })
  } catch {
    return Promise.resolve(false)
  }
}

/**
 * Fire `first_billed_call` if not yet fired for (toolSlug, consumerId)
 * in this process. Caller passes the resolved `costCents` and the
 * `method` — the SDK has both at the meter() call site.
 *
 * Hostile-review fix (H4): same try/catch wrap as
 * `emitSdkFirstInit` so any synchronous failure (null inputs,
 * Set#has on a non-string, etc.) cannot escape into the meter()
 * pipeline.
 */
export function emitFirstBilledCall(args: {
  toolSlug: string
  consumerId: string
  apiUrl: string
  method: string
  amountCents: number
}): Promise<boolean> {
  try {
    if (isSdkTelemetryOptedOut()) return Promise.resolve(false)

    const dedupeKey = `${args.toolSlug}::${args.consumerId}`
    if (firstBilledFiredFor.has(dedupeKey)) return Promise.resolve(false)

    // Bounded-growth guard. When the cap is reached we clear the set
    // — duplicate events afterwards are acceptable (they're not the
    // funnel's load-bearing signal; sdk_first_init is) and avoid an
    // unbounded leak in long-lived tool servers.
    if (firstBilledFiredFor.size >= FIRST_BILLED_MAX_ENTRIES) {
      firstBilledFiredFor.clear()
    }
    firstBilledFiredFor.add(dedupeKey)

    const orgIdHash = hashOrgId(args.toolSlug)
    return postToProxy(args.apiUrl, {
      event: 'first_billed_call',
      properties: {
        method: args.method,
        amount_cents: args.amountCents,
      },
      distinct_id: orgIdHash,
    })
  } catch {
    return Promise.resolve(false)
  }
}
