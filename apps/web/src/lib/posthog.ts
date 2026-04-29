/**
 * P4.1 — Canonical PostHog event registry + capture helpers.
 *
 * This module is the SINGLE SOURCE OF TRUTH for the eight
 * launch-funnel events. It defines:
 *   - `EVENT_NAMES` — frozen tuple of allowed event names. The proxy
 *     at /api/telemetry/capture allow-lists against this; arbitrary
 *     events are rejected with HTTP 400.
 *   - `EventName` — TS string-literal union derived from EVENT_NAMES.
 *   - `captureCanonicalEvent(posthog, event, properties)` — typed
 *     wrapper around `posthog.capture()` for the browser. Pairs with
 *     the `usePostHog()` hook (per the P4.1 spec step 4): emitters
 *     read the instance from the React context provided by
 *     `<PostHogProvider>`, then pass it to this helper.
 *   - `forwardToPostHog(...)` — server-side helper that POSTs an
 *     event to PostHog's `/i/v0/e/` capture endpoint. The proxy
 *     route is the only caller. Never used from client code.
 *
 * The PostHog provider at apps/web/src/components/posthog-provider.tsx
 * remains the bootstrap; this module is a thin canonicalization layer
 * on top.
 *
 * See docs/telemetry/events.md for the full registry, payload shapes,
 * and distinct_id resolution rules.
 *
 * @packageDocumentation
 */
import type { PostHog } from 'posthog-js'

// ─── Canonical event names ──────────────────────────────────────────────────

/**
 * The eight canonical funnel events. Frozen so consumers cannot
 * mutate the allow-list at runtime (a poisoned EVENT_NAMES would
 * let untrusted callers tunnel arbitrary events through the proxy).
 */
export const EVENT_NAMES = Object.freeze([
  'gallery_viewed',
  'template_detail_viewed',
  'shadow_directory_viewed',
  'cli_install_started',
  'scaffold_success',
  'scaffold_failed',
  'sdk_first_init',
  'first_billed_call',
] as const)

/** TS string-literal union of allowed event names. */
export type EventName = (typeof EVENT_NAMES)[number]

/**
 * Type-level membership check. The proxy and tests use this to
 * harden against typo'd event names at compile time.
 */
export function isCanonicalEventName(name: string): name is EventName {
  return (EVENT_NAMES as readonly string[]).includes(name)
}

// ─── Per-event property contracts ───────────────────────────────────────────

/**
 * Property map for each canonical event. Used at typecheck time to
 * make sure callers pass the right keys + value types.
 *
 * Server-enriched fields (`ip_country`, `received_at`) are NOT in
 * this map — those are stamped by the proxy and are not the
 * client's job to supply.
 */
export interface EventProperties {
  gallery_viewed: Record<string, never>
  template_detail_viewed: { slug: string; category: string }
  shadow_directory_viewed: { owner: string; repo: string; has_claim: boolean }
  cli_install_started: {
    cli_version: string
    node_version: string
    os: string
  }
  scaffold_success: { template_slug: string; duration_ms: number }
  scaffold_failed: { template_slug: string; error_code: string }
  sdk_first_init: { sdk_version: string; org_id_hash: string }
  first_billed_call: { method: string; amount_cents: number }
}

// ─── Client-side capture (browser only) ─────────────────────────────────────

/**
 * Typed wrapper around `posthog.capture()`. Pairs with the
 * `usePostHog()` hook from `posthog-js/react` — pass the instance
 * the hook returns (or `null` / `undefined` if the provider hasn't
 * mounted yet). The helper:
 *
 *   - No-ops when `posthog` is null / undefined (SSR, ad-blocker,
 *     env var unset, provider not mounted).
 *   - Re-checks the canonical event-name allow-list at runtime so a
 *     callsite typo'd through a string-literal cast still fails
 *     closed (no untrusted event tunnels into PostHog).
 *   - Swallows every error — telemetry must never throw into product
 *     code. Ad-blocker rejection / CSP / network drop all silent.
 *
 * The browser uses PostHog's anonymous-cookie distinct_id, set by
 * `<PostHogProvider>` at app start, so we never pass it here.
 */
export function captureCanonicalEvent<E extends EventName>(
  posthog: PostHog | null | undefined,
  event: E,
  properties: EventProperties[E],
): void {
  if (!posthog) return
  if (!isCanonicalEventName(event)) return
  try {
    posthog.capture(event, properties as Record<string, unknown>)
  } catch {
    // Telemetry never throws into product code.
  }
}

// ─── Server-side forward (proxy only) ───────────────────────────────────────

/**
 * Default PostHog cloud capture host. The provider also defaults to
 * this. Override per-deployment with `NEXT_PUBLIC_POSTHOG_HOST` (the
 * proxy reuses the same value when forwarding).
 */
export const DEFAULT_POSTHOG_HOST = 'https://us.i.posthog.com' as const

/**
 * Result of a server-side PostHog forward. Returned by the proxy
 * route's underlying call so the route can map outcomes to status
 * codes deterministically.
 */
export interface ForwardResult {
  /** True when PostHog returned 2xx. */
  ok: boolean
  /** HTTP status PostHog returned (or 0 on network/timeout error). */
  status: number
  /** Whether the call was attempted. False when the API key is unset. */
  attempted: boolean
  /** Human-readable reason for non-attempts. Never echoed to clients. */
  reason?: string
}

/**
 * Forward a single event to PostHog. The proxy at
 * /api/telemetry/capture is the only caller.
 *
 * - Bounded I/O: 5s timeout via AbortController.
 * - No retries: telemetry is best-effort; retrying a 500 from
 *   PostHog under load just amplifies congestion.
 * - No follow-redirects: defense-in-depth against a future config
 *   typo pointing at an attacker-controlled domain.
 * - No throws: errors map to `{ ok: false, ... }`.
 */
export async function forwardToPostHog(args: {
  event: EventName
  properties: Record<string, unknown>
  distinctId: string
  apiKey: string | undefined
  host: string
  /**
   * Injection point for tests — pass a mock fetch with the same
   * signature as global `fetch`. Defaults to `globalThis.fetch`.
   */
  fetchImpl?: typeof fetch
  /** Override timeout in ms. Defaults to 5000. */
  timeoutMs?: number
}): Promise<ForwardResult> {
  const { event, properties, distinctId, apiKey, host } = args

  if (!apiKey) {
    return {
      ok: false,
      status: 0,
      attempted: false,
      reason: 'telemetry_disabled',
    }
  }

  const fetchImpl = args.fetchImpl ?? fetch
  const timeoutMs = args.timeoutMs ?? 5000

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  const url = `${host.replace(/\/$/, '')}/i/v0/e/`
  const nowIso = new Date().toISOString()
  const body = JSON.stringify({
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties,
    timestamp: nowIso,
  })

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      redirect: 'error',
      signal: controller.signal,
    })
    return {
      ok: response.ok,
      status: response.status,
      attempted: true,
    }
  } catch (err) {
    return {
      ok: false,
      status: 0,
      attempted: true,
      reason: err instanceof Error ? err.name : 'forward_error',
    }
  } finally {
    clearTimeout(timer)
  }
}
