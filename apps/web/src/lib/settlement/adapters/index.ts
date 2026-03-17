import type { ProtocolAdapter, ProtocolName } from '../types'
import { MCPAdapter } from './mcp'
import { X402Adapter } from './x402'
import { AP2Adapter } from './ap2'
import { TAPAdapter } from './tap'

// ─── Adapter Metrics ──────────────────────────────────────────────────────────

export interface AdapterMetrics {
  readonly invocations: number
  readonly errors: number
  readonly lastInvokedAt: string | null
  readonly lastErrorAt: string | null
}

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
//   1. x402      (has payment-signature or explicit x-settlegrid-protocol: x402)
//   2. ap2       (has x-ap2-mandate or explicit x-settlegrid-protocol: ap2)
//   3. visa-tap  (has x-visa-agent-token or explicit x-settlegrid-protocol: visa-tap)
//   4. mcp       (fallback — any x-api-key or Bearer sg_ token)
//

const DETECTION_PRIORITY: ProtocolName[] = ['x402', 'ap2', 'visa-tap', 'mcp']

// ─── Registry ─────────────────────────────────────────────────────────────────

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
   * Priority: x402 > ap2 > visa-tap > mcp (most specific first).
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

export const protocolRegistry = new ProtocolRegistry()
export const adapterMetrics = new AdapterMetricsTracker()

// ─── Auto-registration ───────────────────────────────────────────────────────
// All four adapters are registered when the settlement module loads.
// Import order follows detection priority (x402 > ap2 > visa-tap > mcp).

protocolRegistry.register(new X402Adapter())
protocolRegistry.register(new AP2Adapter())
protocolRegistry.register(new TAPAdapter())
protocolRegistry.register(new MCPAdapter())

export { ProtocolRegistry, DETECTION_PRIORITY }
