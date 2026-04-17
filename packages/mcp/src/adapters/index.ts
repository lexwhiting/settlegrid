import type { ProtocolAdapter, ProtocolName } from './types'
import { MCPAdapter } from './mcp'
import { X402Adapter } from './x402'
import { AP2Adapter } from './ap2'
import { TAPAdapter } from './tap'
import { MPPAdapter } from './mpp'
import { CircleNanoAdapter } from './circle-nano'
import { MastercardVIAdapter } from './mastercard-vi'
import { ACPAdapter } from './acp'
import { UCPAdapter } from './ucp'
import { L402Adapter } from './l402'
import { AlipayAdapter } from './alipay'
import { KyaPayAdapter } from './kyapay'
import { EmvcoAdapter } from './emvco'
import { DrainAdapter } from './drain'

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
      mpp: this.getMetrics('mpp'),
      ucp: this.getMetrics('ucp'),
      acp: this.getMetrics('acp'),
      'mastercard-vi': this.getMetrics('mastercard-vi'),
      'circle-nano': this.getMetrics('circle-nano'),
      l402: this.getMetrics('l402'),
      alipay: this.getMetrics('alipay'),
      kyapay: this.getMetrics('kyapay'),
      emvco: this.getMetrics('emvco'),
      drain: this.getMetrics('drain'),
    }
  }

  reset(): void {
    this.counters.clear()
  }
}

// ─── Protocol Detection Priority ──────────────────────────────────────────────
//
// When a request has headers matching multiple adapters (e.g. both x-api-key
// and payment-signature), the most-specific protocol wins. The five P2.K2
// emerging protocols (l402, alipay, kyapay, emvco, drain) are appended AFTER
// the brokered ones — they have disjoint header prefixes, so the ordering
// is a tie-breaker for the (rare) multi-header probe case, and it matches
// the legacy chain order in apps/web/src/app/api/proxy/[slug]/route.ts so
// P2.K3's byte-parity snapshot compares cleanly.
//
//   1. mpp          (x-mpp-credential or Bearer mpp_* — HTTP 402 challenge-response)
//   2. circle-nano  (x-circle-nano-auth — x402-compatible, check before x402)
//   3. x402         (payment-signature or explicit x-settlegrid-protocol: x402)
//   4. mastercard-vi(x-mc-verifiable-intent — SD-JWT credential chain)
//   5. ap2          (x-ap2-mandate or explicit x-settlegrid-protocol: ap2)
//   6. acp          (x-acp-token — Stripe SPT via OpenAI)
//   7. ucp          (x-ucp-session — session-based checkout)
//   8. visa-tap     (x-visa-agent-token or explicit x-settlegrid-protocol: visa-tap)
//   9. l402         (Authorization: L402 — Bitcoin Lightning)
//  10. alipay       (x-alipay-agent-token — ACTP, Ant Group)
//  11. kyapay       (x-kyapay-token — Skyfire/Visa Intelligent Commerce)
//  12. emvco        (x-emvco-agent-token — card networks)
//  13. drain        (x-drain-voucher — EIP-712 off-chain USDC)
//  14. mcp          (fallback — any x-api-key or Bearer sg_ token)
//

const DETECTION_PRIORITY: ProtocolName[] = [
  'mpp',
  'circle-nano',
  'x402',
  'mastercard-vi',
  'ap2',
  'acp',
  'ucp',
  'visa-tap',
  'l402',
  'alipay',
  'kyapay',
  'emvco',
  'drain',
  'mcp',
]

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
   * Priority: mpp > circle-nano > x402 > mastercard-vi > ap2 > acp > ucp >
   * visa-tap > l402 > alipay > kyapay > emvco > drain > mcp.
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
// All fourteen adapters are registered when the settlement module loads.
// Import order follows detection priority (most specific first).

protocolRegistry.register(new MPPAdapter())
protocolRegistry.register(new CircleNanoAdapter())
protocolRegistry.register(new X402Adapter())
protocolRegistry.register(new MastercardVIAdapter())
protocolRegistry.register(new AP2Adapter())
protocolRegistry.register(new ACPAdapter())
protocolRegistry.register(new UCPAdapter())
protocolRegistry.register(new TAPAdapter())
protocolRegistry.register(new L402Adapter())
protocolRegistry.register(new AlipayAdapter())
protocolRegistry.register(new KyaPayAdapter())
protocolRegistry.register(new EmvcoAdapter())
protocolRegistry.register(new DrainAdapter())
protocolRegistry.register(new MCPAdapter())

export { ProtocolRegistry, DETECTION_PRIORITY }
