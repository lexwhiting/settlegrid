/**
 * P2.K2 method-migration tests — verifies every bundled adapter exposes
 * the spec-required `verify()` and `build402Response()` methods, and that
 * the 9 existing adapters (mpp, x402, ap2, visa-tap, acp, ucp, mastercard-vi,
 * circle-nano, mcp) correctly delegate their validation + 402 generation
 * logic through the new class method surface.
 *
 * The 5 new adapter test files (adapter-{l402,alipay,kyapay,emvco,drain}.test.ts)
 * already exercise verify / build402Response indirectly via the module-level
 * `validate<X>Payment` / `generate<X>402Response` calls. This file closes
 * the gap for the existing 9 and adds a contract test that iterates all 14.
 */

import { describe, it, expect } from 'vitest'
import {
  MPPAdapter,
  X402Adapter,
  AP2Adapter,
  TAPAdapter,
  ACPAdapter,
  UCPAdapter,
  MastercardVIAdapter,
  CircleNanoAdapter,
  MCPAdapter,
  L402Adapter,
  AlipayAdapter,
  KyaPayAdapter,
  EmvcoAdapter,
  DrainAdapter,
  protocolRegistry,
} from '../index'

const APP_URL = 'https://settlegrid.test'
const TOOL_CONFIG = { slug: 'test-tool', costCents: 5, displayName: 'Test Tool' }

// ─── Contract: every bundled adapter has verify() + build402Response() ─────

describe('P2.K2 — adapter class method contract', () => {
  const bundled = [
    { name: 'mpp', cls: MPPAdapter },
    { name: 'x402', cls: X402Adapter },
    { name: 'ap2', cls: AP2Adapter },
    { name: 'visa-tap', cls: TAPAdapter },
    { name: 'acp', cls: ACPAdapter },
    { name: 'ucp', cls: UCPAdapter },
    { name: 'mastercard-vi', cls: MastercardVIAdapter },
    { name: 'circle-nano', cls: CircleNanoAdapter },
    { name: 'mcp', cls: MCPAdapter },
    { name: 'l402', cls: L402Adapter },
    { name: 'alipay', cls: AlipayAdapter },
    { name: 'kyapay', cls: KyaPayAdapter },
    { name: 'emvco', cls: EmvcoAdapter },
    { name: 'drain', cls: DrainAdapter },
  ]

  it.each(bundled)('$name adapter exposes verify()', ({ cls }) => {
    const instance = new cls()
    expect(typeof instance.verify).toBe('function')
  })

  it.each(bundled.filter((b) => b.name !== 'mcp'))(
    '$name adapter exposes build402Response()',
    ({ cls }) => {
      const instance = new cls()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(typeof (instance as any).build402Response).toBe('function')
    },
  )

  it('protocolRegistry.get returns adapters that expose verify()', () => {
    for (const { name } of bundled) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const adapter = protocolRegistry.get(name as any)
      expect(adapter).toBeDefined()
      expect(typeof adapter!.verify).toBe('function')
    }
  })
})

// ─── Existing 9 adapters — verify() + build402Response() smoke ─────────────

describe('MPPAdapter.verify / build402Response', () => {
  const adapter = new MPPAdapter()

  it('verify returns MPP_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MPP_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with MPP protocol header', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-Payment-Protocol')).toMatch(/^MPP/)
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('mpp')
  })
})

describe('X402Adapter.verify / build402Response', () => {
  const adapter = new X402Adapter()

  it('verify returns X402_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('X402_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with X-Payment-Required base64 header', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-Payment-Required')).toBeTruthy()
    const body = (await res.json()) as Record<string, unknown>
    expect(body.x402Version).toBe(2)
  })
})

describe('AP2Adapter.verify / build402Response', () => {
  const adapter = new AP2Adapter()

  it('verify returns AP2_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('AP2_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with AP2 protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('ap2')
    const body = (await res.json()) as Record<string, unknown>
    expect(body.protocol).toBe('ap2')
  })
})

describe('TAPAdapter.verify / build402Response', () => {
  const adapter = new TAPAdapter()

  it('verify returns VISA_TAP_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('VISA_TAP_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with visa-tap protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('visa-tap')
  })
})

describe('ACPAdapter.verify / build402Response', () => {
  const adapter = new ACPAdapter()

  it('verify returns ACP_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('ACP_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with acp protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('acp')
  })
})

describe('UCPAdapter.verify / build402Response', () => {
  const adapter = new UCPAdapter()

  it('verify returns UCP_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('UCP_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with ucp protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('ucp')
  })
})

describe('MastercardVIAdapter.verify / build402Response', () => {
  const adapter = new MastercardVIAdapter()

  it('verify returns MC_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('MC_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with mastercard-vi protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('mastercard-vi')
  })
})

describe('CircleNanoAdapter.verify / build402Response', () => {
  const adapter = new CircleNanoAdapter()

  it('verify returns CIRCLE_NANO_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
    expect(res.error?.code).toBe('CIRCLE_NANO_NOT_CONFIGURED')
  })

  it('build402Response returns 402 with circle-nano protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('circle-nano')
  })
})

describe('MCPAdapter.verify', () => {
  const adapter = new MCPAdapter()

  it('verify() delegates to extractPaymentContext for MCP requests', async () => {
    const req = new Request('http://localhost/api/sdk/meter', {
      method: 'POST',
      headers: {
        'x-api-key': 'sg_live_abc',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ method: 'search', toolSlug: 'my-tool' }),
    })
    const ctx = await adapter.verify(req)
    expect(ctx.protocol).toBe('mcp')
    expect(ctx.identity.value).toBe('sg_live_abc')
  })
})

// ─── New 5 adapters — verify class-method path (module-level path is ─────
//     covered by adapter-{l402,alipay,kyapay,emvco,drain}.test.ts) ────────

describe('L402Adapter.verify / build402Response (class method path)', () => {
  const adapter = new L402Adapter()

  it('verify returns L402_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
  })

  it('build402Response returns 402 with WWW-Authenticate', async () => {
    const res = await adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('WWW-Authenticate')).toMatch(/^L402 /)
  })
})

describe('AlipayAdapter.verify / build402Response (class method path)', () => {
  const adapter = new AlipayAdapter()

  it('verify returns ALIPAY_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
  })

  it('build402Response returns 402 with alipay protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('alipay')
  })
})

describe('KyaPayAdapter.verify / build402Response (class method path)', () => {
  const adapter = new KyaPayAdapter()

  it('verify returns KYAPAY_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
  })

  it('build402Response returns 402 with kyapay protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('kyapay')
  })
})

describe('EmvcoAdapter.verify / build402Response (class method path)', () => {
  const adapter = new EmvcoAdapter()

  it('verify returns EMVCO_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
  })

  it('build402Response returns 402 with emvco protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('emvco')
  })
})

describe('DrainAdapter.verify / build402Response (class method path)', () => {
  const adapter = new DrainAdapter()

  it('verify returns DRAIN_NOT_CONFIGURED when enabled=false', async () => {
    const res = await adapter.verify(new Request('http://localhost/api/proxy/t'), {
      enabled: false,
      toolConfig: TOOL_CONFIG,
    })
    expect(res.valid).toBe(false)
  })

  it('build402Response returns 402 with drain protocol marker', async () => {
    const res = adapter.build402Response({
      toolSlug: 't',
      costCents: 5,
      appUrl: APP_URL,
    })
    expect(res.status).toBe(402)
    expect(res.headers.get('X-SettleGrid-Protocol')).toBe('drain')
  })
})
