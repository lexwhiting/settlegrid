/**
 * @deprecated
 *
 * This Layer A adapter directory is scheduled for removal.
 *
 * The nine protocol adapters have been bundled into the SDK as of P1.K1 and
 * are now maintained at `packages/mcp/src/adapters/` (published as part of
 * `@settlegrid/mcp`). New code should import from `@settlegrid/mcp` instead:
 *
 * ```ts
 * import {
 *   protocolRegistry,
 *   ProtocolRegistry,
 *   DETECTION_PRIORITY,
 *   type ProtocolAdapter,
 *   type PaymentContext,
 *   type SettlementResult,
 * } from '@settlegrid/mcp'
 * ```
 *
 * These files are retained for one more release cycle so any
 * still-unmigrated callers keep working. The marketplace proxy never
 * imported this directory and is unaffected; the full Layer A removal
 * is tracked as P2.K1 (marketplace proxy unification). See
 * `docs/phase-reports/PHASE_1_SUMMARY.md` §2b for the deferred-work ledger.
 */
import type { ProtocolAdapter, ProtocolName } from '../types'
import { MCPAdapter } from './mcp'
import { X402Adapter } from './x402'
import { AP2Adapter } from './ap2'
import { TAPAdapter } from './tap'
import { MPPAdapter } from './mpp'
import { CircleNanoAdapter } from './circle-nano'
import { MastercardVIAdapter } from './mastercard-vi'
import { ACPAdapter } from './acp'
import { UCPAdapter } from './ucp'

// ─── Adapter Metrics ──────────────────────────────────────────────────────────

/**
 * @deprecated Use `@settlegrid/mcp` instead (P1.K1). This Layer A copy will
 * be removed in P2.K1; see the file header for the full migration note.
 */
export interface AdapterMetrics {
  readonly invocations: number
  readonly errors: number
  readonly lastInvokedAt: string | null
  readonly lastErrorAt: string | null
}

/**
 * @deprecated Use `@settlegrid/mcp` instead (P1.K1). This Layer A copy will
 * be removed in P2.K1; see the file header for the full migration note.
 */
export interface MetricsTracker {
  recordInvocation(protocol: ProtocolName): void
  recordError(protocol: ProtocolName): void
  getMetrics(protocol: ProtocolName): AdapterMetrics
  getAllMetrics(): Record<ProtocolName, AdapterMetrics>
  reset(): void
}

function createEmptyMetrics(): AdapterMetrics {
  return { invocations: 0, errors: 0, lastInvokedAt: null, lastErrorAt: null }
}

class AdapterMetricsTracker implements MetricsTracker {
  private counters = new Map<ProtocolName, { invocations: number; errors: number; lastInvokedAt: string | null; lastErrorAt: string | null }>()

  recordInvocation(protocol: ProtocolName): void {
    const m = this.counters.get(protocol) ?? { invocations: 0, errors: 0, lastInvokedAt: null, lastErrorAt: null }
    m.invocations++
    m.lastInvokedAt = new Date().toISOString()
    this.counters.set(protocol, m)
  }

  recordError(protocol: ProtocolName): void {
    const m = this.counters.get(protocol) ?? { invocations: 0, errors: 0, lastInvokedAt: null, lastErrorAt: null }
    m.errors++
    m.lastErrorAt = new Date().toISOString()
    this.counters.set(protocol, m)
  }

  getMetrics(protocol: ProtocolName): AdapterMetrics {
    return this.counters.get(protocol) ?? createEmptyMetrics()
  }

  getAllMetrics(): Record<ProtocolName, AdapterMetrics> {
    return {
      mcp: this.getMetrics('mcp'),
      x402: this.getMetrics('x402'),
      ap2: this.getMetrics('ap2'),
      'visa-tap': this.getMetrics('visa-tap'),
      mpp: this.getMetrics('mpp'),
      ucp: this.getMetrics('ucp'),
      acp: this.getMetrics('acp'),
      'mastercard-vi': this.getMetrics('mastercard-vi'),
      'circle-nano': this.getMetrics('circle-nano'),
    }
  }

  reset(): void {
    this.counters.clear()
  }
}

// ─── Protocol Detection Priority ──────────────────────────────────────────────
//
// When a request has headers matching multiple adapters (e.g. both x-api-key
// and payment-signature), the most-specific protocol wins:
//
//   1. mpp          (x-mpp-credential or Bearer mpp_* — HTTP 402 challenge-response)
//   2. circle-nano  (x-circle-nano-auth — x402-compatible, check before x402)
//   3. x402         (payment-signature or explicit x-settlegrid-protocol: x402)
//   4. mastercard-vi(x-mc-verifiable-intent — SD-JWT credential chain)
//   5. ap2          (x-ap2-mandate or explicit x-settlegrid-protocol: ap2)
//   6. acp          (x-acp-token — Stripe SPT via OpenAI)
//   7. ucp          (x-ucp-session — session-based checkout)
//   8. visa-tap     (x-visa-agent-token or explicit x-settlegrid-protocol: visa-tap)
//   9. mcp          (fallback — any x-api-key or Bearer sg_ token)
//

/**
 * @deprecated Use `DETECTION_PRIORITY` from `@settlegrid/mcp` instead (P1.K1).
 * This Layer A copy will be removed in P2.K1.
 */
const DETECTION_PRIORITY: ProtocolName[] = [
  'mpp',
  'circle-nano',
  'x402',
  'mastercard-vi',
  'ap2',
  'acp',
  'ucp',
  'visa-tap',
  'mcp',
]

// ─── Registry ─────────────────────────────────────────────────────────────────

/**
 * @deprecated Use `ProtocolRegistry` from `@settlegrid/mcp` instead (P1.K1).
 * This Layer A copy will be removed in P2.K1; the canonical implementation
 * lives at `packages/mcp/src/adapters/index.ts` and is published as part of
 * the `@settlegrid/mcp` package.
 */
class ProtocolRegistry {
  private adapters = new Map<ProtocolName, ProtocolAdapter>()

  register(adapter: ProtocolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter already registered for protocol: ${adapter.name}`)
    }
    this.adapters.set(adapter.name, adapter)
  }

  get(name: ProtocolName): ProtocolAdapter | undefined {
    return this.adapters.get(name)
  }

  /**
   * Detect the correct adapter for a request using priority order.
   * Priority: mpp > circle-nano > x402 > mastercard-vi > ap2 > acp > ucp > visa-tap > mcp.
   * This ensures that a request with both an API key (MCP) and a
   * payment-signature (x402) routes to x402, not MCP.
   */
  detect(request: Request): ProtocolAdapter | undefined {
    for (const name of DETECTION_PRIORITY) {
      const adapter = this.adapters.get(name)
      if (adapter?.canHandle(request)) {
        return adapter
      }
    }
    return undefined
  }

  list(): ProtocolAdapter[] {
    return Array.from(this.adapters.values())
  }

  has(name: ProtocolName): boolean {
    return this.adapters.has(name)
  }

  clear(): void {
    this.adapters.clear()
  }

  /** Returns the priority order used by detect() */
  get detectionPriority(): readonly ProtocolName[] {
    return DETECTION_PRIORITY
  }
}

// ─── Singleton instances ──────────────────────────────────────────────────────

/**
 * @deprecated Use `protocolRegistry` from `@settlegrid/mcp` instead (P1.K1).
 * This Layer A singleton will be removed in P2.K1.
 */
export const protocolRegistry = new ProtocolRegistry()
/**
 * @deprecated No direct replacement is re-exported from `@settlegrid/mcp` yet.
 * If you need adapter metrics, construct your own instance via the
 * `MetricsTracker` interface in `@settlegrid/mcp` or file a request to expose
 * a public metrics surface. This Layer A singleton will be removed in P2.K1.
 */
export const adapterMetrics = new AdapterMetricsTracker()

// ─── Auto-registration ───────────────────────────────────────────────────────
// All nine adapters are registered when the settlement module loads.
// Import order follows detection priority (most specific first).

protocolRegistry.register(new MPPAdapter())
protocolRegistry.register(new CircleNanoAdapter())
protocolRegistry.register(new X402Adapter())
protocolRegistry.register(new MastercardVIAdapter())
protocolRegistry.register(new AP2Adapter())
protocolRegistry.register(new ACPAdapter())
protocolRegistry.register(new UCPAdapter())
protocolRegistry.register(new TAPAdapter())
protocolRegistry.register(new MCPAdapter())

export { ProtocolRegistry, DETECTION_PRIORITY }
