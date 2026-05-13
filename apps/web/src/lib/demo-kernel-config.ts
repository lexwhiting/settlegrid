/**
 * P4.K1 — sandbox configuration and helpers for the public kernel demo.
 *
 * The hostile-review contract for this module:
 *
 *   (a) NO REAL MONEY: every kernel network call must terminate at a
 *       sandbox endpoint that returns deterministic stubs. The sandbox
 *       endpoints (`/api/demo/sandbox/[...path]`) never call Stripe,
 *       a chain, Voltage/LND, or the production database.
 *
 *   (b) CREDENTIALS SERVER-SIDE ONLY: the sandbox `toolSecret` lives
 *       on this server. The browser never sees it; the kernel forwards
 *       it as `Authorization: Bearer <secret>` to the sandbox URL only.
 *
 *   (c) UNMODIFIED KERNEL: this module imports `createDispatchKernel`
 *       and `settlegrid` directly from `@settlegrid/mcp`. There is no
 *       fork, monkey-patch, or wrapper around the kernel — only the
 *       configuration we hand `settlegrid.init({...})` differs from
 *       production.
 *
 * The module also exposes a routing-decision helper that runs
 * `protocolRegistry.detect(request)` BEFORE calling the kernel so the
 * UI can show "what the kernel will do" without forking it. The
 * detection result is the same logic the kernel itself runs — we just
 * read it twice (once for the UI, once inside the kernel).
 */

import {
  createDispatchKernel,
  createKernelEmitter,
  protocolRegistry,
  settlegrid,
  type DispatchKernel,
  type ProtocolName,
  type SettleGridInstance,
} from '@settlegrid/mcp'

/* -------------------------------------------------------------------------- */
/*  Sandbox configuration constants                                            */
/* -------------------------------------------------------------------------- */

/**
 * Tool slug used for the demo's sg instance. Hardcoded sentinel so a
 * grep across logs or audit rows immediately reveals "this came from
 * the demo, not a real customer." The slug never touches a real
 * `tools` row in the database — sandbox endpoints don't read the DB.
 */
export const DEMO_TOOL_SLUG = 'demo-sandbox-tool' as const

/**
 * Sandbox toolSecret. Used only to authenticate the kernel→sandbox
 * round-trip; the sandbox endpoint pattern-matches on the value to
 * confirm "this came from a kernel that was built with our config."
 *
 * NOT a security boundary — anyone reading this source knows it. The
 * security guarantee is "the sandbox endpoints never settle real
 * money, regardless of who calls them," not "only our kernel can
 * call the sandbox." Listed here as a constant so the value is in
 * one place and so the test suite can assert end-to-end consistency.
 */
export const DEMO_TOOL_SECRET = 'demo-sandbox-secret' as const

/**
 * Compute the absolute apiUrl the kernel will fetch for sandbox
 * round-trips. The kernel composes URLs as
 * `${config.apiUrl}/api/${protocol}/${action}` (kernel.ts) and
 * `${config.apiUrl}/api/sdk${path}` (middleware.ts), so apiUrl must
 * be the URL prefix BEFORE the `/api/...` segment.
 *
 * In production this resolves to
 * `https://settlegrid.ai/api/demo/sandbox`, which means the kernel
 * issues fetches like `https://settlegrid.ai/api/demo/sandbox/api/
 * x402/verify` — caught by the catch-all route at
 * `apps/web/src/app/api/demo/sandbox/[...path]/route.ts`.
 */
export function resolveSandboxApiUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'http://localhost:3005'
  return `${appUrl}/api/demo/sandbox`
}

/**
 * Lazily build a fresh `sg` instance per call. Cheap (synchronous
 * config validation only) and avoids module-load-time env-var
 * resolution that would otherwise burn into the build's static cache.
 *
 * Keeping per-call instances also keeps the request handler stateless:
 * the demo's middleware caches don't accumulate across visitors.
 */
export function buildDemoSg(): SettleGridInstance {
  return settlegrid.init({
    apiUrl: resolveSandboxApiUrl(),
    toolSlug: DEMO_TOOL_SLUG,
    toolSecret: DEMO_TOOL_SECRET,
    pricing: { defaultCostCents: 5 },
    timeoutMs: 5000,
  })
}

/**
 * Build the demo dispatch kernel against a fresh sg. The kernel has
 * no per-call state itself, but `buildDemoSg` does (middleware cache,
 * normalized config), so building once per request is the safe default.
 *
 * P5.K1 Option C — wires `createKernelEmitter` with the platform's
 * `KERNEL_TELEMETRY_AUTH_TOKEN` so demo traffic actually populates the
 * `/admin/kernel-health` dashboard. When the env is unset (pre-launch
 * local dev), the emitter still calls the sink, which returns
 * `200 + sink_disabled` and the SDK's fire-and-forget swallows the
 * no-op — same graceful-degradation behavior as before. When set
 * (post-launch on Vercel), events flow through, the sink writes to
 * `kernel_telemetry`, and the dashboard renders real data.
 *
 * `apiUrl` for the emitter is the public app URL (NOT the sandbox
 * URL the kernel itself targets) — the sink lives at
 * `/api/telemetry/kernel` on the main app, not under `/api/demo/sandbox`.
 */
export function buildDemoKernel(): DispatchKernel {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ??
    'http://localhost:3005'
  const emitter = createKernelEmitter({
    apiUrl: appUrl,
    authToken: process.env.KERNEL_TELEMETRY_AUTH_TOKEN,
  })
  return createDispatchKernel(buildDemoSg(), { emitter })
}

/* -------------------------------------------------------------------------- */
/*  Demo request handler                                                       */
/* -------------------------------------------------------------------------- */

/**
 * The handler the kernel calls between verify and settle. Returns a
 * deterministic small payload so the response viewer always shows
 * the same shape — visitors aren't troubleshooting handler
 * variability, they're inspecting the kernel's protocol routing.
 */
export interface DemoHandlerResult {
  ok: true
  message: string
  echoedMethod: string
}

export async function demoHandler(ctx: {
  operation: { method: string }
}): Promise<DemoHandlerResult> {
  return {
    ok: true,
    message: 'demo handler executed (no real work performed)',
    echoedMethod: ctx.operation.method,
  }
}

/* -------------------------------------------------------------------------- */
/*  Routing decision (pre-call inspection)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Phase-1 protocols the kernel actually dispatches end-to-end. Mirrors
 * `PHASE_1_KERNEL_PROTOCOLS` in `packages/mcp/src/kernel.ts` — kept in
 * sync deliberately as a hardcoded mirror rather than imported, since
 * the kernel keeps that constant non-exported. If the kernel adds an
 * adapter to its dispatch surface (e.g., L402 macaroon flow lands in
 * Phase 2), update this list to match. The `compare-nevermined`
 * runtime tests catch drift in the SHIPPED_ADAPTERS export; this list
 * has no analogous source-of-truth, so the demo-kernel-config tests
 * pin its expected value.
 *
 * Deferred work that grows this list:
 *   docs/phase-reports/P5-kernel-dispatch-expansion-deferred.md
 *
 * When the kernel side adds an adapter (e.g. AP2 from Tier 1):
 *   1. Add the protocol name here.
 *   2. The /demo/kernel page automatically reclassifies that adapter
 *      from "402-manifest only" to "settled end-to-end" on next build.
 *   3. The compare-nevermined narrative copy may need an update
 *      ("3 settled / 11 detected" → "4 settled / 10 detected").
 */
export const KERNEL_DISPATCHED_PROTOCOLS: readonly ProtocolName[] = [
  'mcp',
  'x402',
  'mpp',
] as const

/**
 * Step in the routing-decision viewer. The shape is
 * UI-render-friendly: `state` drives the ✓/✗/-- icon, `label` is
 * shown as the step title, `detail` is optional supporting copy.
 */
export interface RoutingDecisionStep {
  label: string
  state: 'pending' | 'success' | 'skipped' | 'failure'
  detail?: string
}

/**
 * Result of the pre-call inspection. The viewer renders these steps
 * in order; the kernel call's actual response then fills in the
 * trailing "Settled" / "Returned 402 manifest" / "Errored" outcome.
 */
export interface RoutingDecision {
  detected: {
    /** null when no adapter matched the request shape. */
    protocol: ProtocolName | null
    /** Adapter display name — undefined when `protocol` is null. */
    displayName?: string
  }
  /**
   * Which path the kernel will run. `'sg-balance'` for MCP,
   * `'facilitator'` for x402/MPP, `'402-manifest'` for everything
   * else (including the no-adapter-matched case).
   */
  dispatchPath: 'sg-balance' | 'facilitator' | '402-manifest'
  steps: RoutingDecisionStep[]
}

/**
 * Compute the routing decision the kernel will follow for this
 * request, by running the same `protocolRegistry.detect()` the kernel
 * runs internally. Returns a UI-shaped object the response viewer
 * can render directly.
 *
 * NOTE: this clones the request before reading body-bearing detection
 * (some adapter `canHandle` calls inspect the body). The original
 * Request is then handed to the kernel, which gets a fresh body
 * stream. Without the clone, the kernel's inner `extractPaymentContext`
 * would see an already-consumed stream and the dispatch would fail in
 * a way that's not reproducible from the visitor's perspective.
 */
export function inspectRouting(request: Request): RoutingDecision {
  const adapter = protocolRegistry.detect(request)
  if (!adapter) {
    return {
      detected: { protocol: null },
      dispatchPath: '402-manifest',
      steps: [
        {
          label: 'Protocol detection',
          state: 'success',
          detail:
            'No protocol header matched. Kernel will return a multi-protocol 402 manifest.',
        },
        { label: 'Verify payment', state: 'skipped' },
        { label: 'Authorize invocation', state: 'skipped' },
        { label: 'Run developer handler', state: 'skipped' },
        { label: 'Settle / format response', state: 'skipped' },
      ],
    }
  }

  const dispatchPath = computeDispatchPath(adapter.name)
  const detected = {
    protocol: adapter.name,
    displayName: adapter.displayName,
  }

  if (dispatchPath === '402-manifest') {
    return {
      detected,
      dispatchPath,
      steps: [
        {
          label: 'Protocol detection',
          state: 'success',
          detail: `Detected ${adapter.displayName}. Phase-2 adapter — kernel returns 402 manifest instead of settling.`,
        },
        {
          label: 'Verify payment',
          state: 'skipped',
          detail: 'Skipped — adapter not yet wired into kernel dispatch.',
        },
        { label: 'Authorize invocation', state: 'skipped' },
        { label: 'Run developer handler', state: 'skipped' },
        {
          label: 'Settle / format response',
          state: 'skipped',
          detail: 'Will return 402 manifest with this protocol in `accepts[]`.',
        },
      ],
    }
  }

  if (dispatchPath === 'sg-balance') {
    return {
      detected,
      dispatchPath,
      steps: [
        {
          label: 'Protocol detection',
          state: 'success',
          detail: `Detected ${adapter.displayName}. Routes through the sg-balance pipeline.`,
        },
        { label: 'Validate API key', state: 'pending' },
        { label: 'Check credit balance', state: 'pending' },
        { label: 'Authorize invocation (gate)', state: 'pending' },
        { label: 'Run developer handler', state: 'pending' },
        { label: 'Meter & format response', state: 'pending' },
      ],
    }
  }

  return {
    detected,
    dispatchPath,
    steps: [
      {
        label: 'Protocol detection',
        state: 'success',
        detail: `Detected ${adapter.displayName}. Routes through the facilitator pipeline.`,
      },
      { label: 'Verify payment via facilitator', state: 'pending' },
      { label: 'Authorize invocation (gate)', state: 'pending' },
      { label: 'Run developer handler', state: 'pending' },
      { label: 'Settle via facilitator', state: 'pending' },
      { label: 'Format response', state: 'pending' },
    ],
  }
}

function computeDispatchPath(
  protocol: ProtocolName,
): RoutingDecision['dispatchPath'] {
  if (protocol === 'mcp') return 'sg-balance'
  if (protocol === 'x402' || protocol === 'mpp') return 'facilitator'
  return '402-manifest'
}

/* -------------------------------------------------------------------------- */
/*  Source links                                                               */
/* -------------------------------------------------------------------------- */

const GITHUB_BASE = 'https://github.com/lexwhiting/settlegrid' as const

/**
 * Map a protocol to the GitHub blob URL for its adapter source. The
 * "view in source" link in the response viewer uses this so a visitor
 * can confirm we're not hand-waving — the file at the link literally
 * contains the protocol detection logic the kernel just ran.
 */
export function adapterSourceUrl(protocol: ProtocolName): string {
  return `${GITHUB_BASE}/blob/main/packages/mcp/src/adapters/${protocol}.ts`
}

/** Source URL for the kernel itself — used in the page footer. */
export const KERNEL_SOURCE_URL =
  `${GITHUB_BASE}/blob/main/packages/mcp/src/kernel.ts` as const

/* -------------------------------------------------------------------------- */
/*  Public adapter inventory (for the request builder UI)                     */
/* -------------------------------------------------------------------------- */

/**
 * UI-facing snapshot of every adapter the registry knows about. Built
 * from the registry at module load (cheap — adapters are static
 * objects). The request-builder dropdown reads this list rather than
 * a hardcoded copy so the UI tracks the kernel's actual capabilities.
 */
export interface AdapterSummary {
  name: ProtocolName
  displayName: string
  dispatchPath: RoutingDecision['dispatchPath']
  sourceUrl: string
}

export function listAdapters(): AdapterSummary[] {
  // protocolRegistry.list() returns a fresh array on every call — see
  // packages/mcp/src/adapters/index.ts:159. Cheap to invoke; we shape
  // it for the UI rather than caching the array, so a kernel-side
  // adapter registration that lands at runtime would be reflected.
  return protocolRegistry.list().map((a) => ({
    name: a.name,
    displayName: a.displayName,
    dispatchPath: computeDispatchPath(a.name),
    sourceUrl: adapterSourceUrl(a.name),
  }))
}
