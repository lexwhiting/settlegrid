/**
 * P5.K1 — kernel emission wiring integration tests.
 *
 * These tests exercise the 8 `emitter.emit()` call sites inside
 * `kernel.ts` end-to-end by feeding `createDispatchKernel` a
 * `memoryKernelEmitter` and running a real dispatch. They are the
 * complement to `kernel-telemetry.test.ts` (which covers the emitter +
 * sanitizer in isolation) — `kernel.test.ts` doesn't pass an emitter,
 * so the wiring is otherwise unverified.
 *
 * Coverage:
 *   - sg-balance happy path — request_received → routing_decision →
 *     adapter_latency_ms(success=true) → invocation_settled(rail='mcp')
 *   - sg-balance failure (validate-key invalid) — request_received +
 *     routing_decision + adapter_error + adapter_latency_ms(success=false),
 *     and NOT invocation_settled
 *   - Snake-case property names hit the wire (regression guard for the
 *     spec-diff fix in 94c165b5)
 *   - PHASE_1_KERNEL_PROTOCOLS ends up in routing_decision.alternatives
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { settlegrid, createDispatchKernel } from '../index'
import { memoryKernelEmitter } from '../kernel-telemetry'

interface FetchCall {
  url: string
  body: unknown
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mcpRequest(): Request {
  return new Request('http://localhost/api/tool/run', {
    method: 'POST',
    headers: {
      'x-api-key': 'sg_live_test_emission',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ method: 'search', toolSlug: 'emission-tool' }),
  })
}

let fetchMock: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchMock = vi.fn(async () => new Response('{}', { status: 404 }))
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('kernel emission wiring (P5.K1)', () => {
  it('emits request_received → routing_decision → adapter_latency_ms → invocation_settled on a successful sg-balance dispatch', async () => {
    const calls: FetchCall[] = []
    fetchMock.mockImplementation(async (url: string, init: RequestInit) => {
      calls.push({ url, body: init.body })
      if (url.endsWith('/api/sdk/validate-key')) {
        return jsonResponse({
          valid: true,
          consumerId: 'con-em',
          toolId: 'tool-em',
          keyId: 'key-em',
          balanceCents: 10_000,
        })
      }
      if (url.endsWith('/api/sdk/meter')) {
        return jsonResponse({
          success: true,
          remainingBalanceCents: 9_995,
          costCents: 5,
          invocationId: 'inv-em',
        })
      }
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 5 },
    })
    const emitter = memoryKernelEmitter()
    const kernel = createDispatchKernel(sg, { emitter })

    const handler = vi.fn().mockResolvedValue({ result: 'ok' })
    const response = await kernel.handle(mcpRequest(), handler)
    expect(response.status).toBe(200)
    expect(handler).toHaveBeenCalledTimes(1)

    // Four events on the success path. Order is: request_received,
    // routing_decision, adapter_latency_ms (after pipeline), then
    // invocation_settled is fired *inside* handleSgBalance which
    // returns BEFORE the outer adapter_latency_ms — so the actual
    // wire order is request_received, routing_decision,
    // invocation_settled, adapter_latency_ms.
    const names = emitter.events.map((e) => e.name)
    expect(names).toEqual([
      'kernel.request_received',
      'kernel.routing_decision',
      'kernel.invocation_settled',
      'kernel.adapter_latency_ms',
    ])

    // Spot-check each event's adapter is the MCP adapter.
    for (const e of emitter.events) {
      expect((e.props as { adapter: string }).adapter).toBe('mcp')
    }
  })

  it('uses snake_case property names on the wire (spec §P5.K1)', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/sdk/validate-key'))
        return jsonResponse({
          valid: true,
          consumerId: 'c',
          toolId: 't',
          keyId: 'k',
          balanceCents: 10_000,
        })
      if (url.endsWith('/api/sdk/meter'))
        return jsonResponse({
          success: true,
          remainingBalanceCents: 9_990,
          costCents: 10,
          invocationId: 'inv-snake',
        })
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 10 },
    })
    const emitter = memoryKernelEmitter()
    const kernel = createDispatchKernel(sg, { emitter })
    await kernel.handle(mcpRequest(), async () => ({}))

    // request_received uses dev_id + amount_cents (not devId / amountCents).
    const recv = emitter.events.find((e) => e.name === 'kernel.request_received')
    expect(recv).toBeDefined()
    const recvProps = recv!.props as unknown as Record<string, unknown>
    expect('dev_id' in recvProps).toBe(true)
    expect('amount_cents' in recvProps).toBe(true)
    expect('devId' in recvProps).toBe(false)
    expect('amountCents' in recvProps).toBe(false)

    // routing_decision uses fee_bps + alternatives_considered.
    const route = emitter.events.find((e) => e.name === 'kernel.routing_decision')
    const routeProps = route!.props as unknown as Record<string, unknown>
    expect('fee_bps' in routeProps).toBe(true)
    expect('alternatives_considered' in routeProps).toBe(true)

    // adapter_latency_ms uses latency_ms + success.
    const lat = emitter.events.find((e) => e.name === 'kernel.adapter_latency_ms')
    const latProps = lat!.props as unknown as Record<string, unknown>
    expect('latency_ms' in latProps).toBe(true)
    expect('success' in latProps).toBe(true)
    expect(latProps.success).toBe(true)

    // invocation_settled uses amount_cents + take_cents + latency_ms.
    const settled = emitter.events.find((e) => e.name === 'kernel.invocation_settled')
    const sProps = settled!.props as unknown as Record<string, unknown>
    expect('amount_cents' in sProps).toBe(true)
    expect('take_cents' in sProps).toBe(true)
    expect('latency_ms' in sProps).toBe(true)
    expect(sProps.rail).toBe('mcp')
    // sg-balance flow: take_cents is 0 (platform fee captured via
    // Stripe Connect application_fee server-side, not pre-deducted).
    expect(sProps.take_cents).toBe(0)
    expect(sProps.amount_cents).toBe(10)
  })

  it('routing_decision.alternatives_considered enumerates Phase 1 protocols', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/sdk/validate-key'))
        return jsonResponse({
          valid: true,
          consumerId: 'c',
          toolId: 't',
          keyId: 'k',
          balanceCents: 10_000,
        })
      if (url.endsWith('/api/sdk/meter'))
        return jsonResponse({
          success: true,
          remainingBalanceCents: 9_995,
          costCents: 5,
          invocationId: 'inv-alt',
        })
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 5 },
    })
    const emitter = memoryKernelEmitter()
    const kernel = createDispatchKernel(sg, { emitter })
    await kernel.handle(mcpRequest(), async () => ({}))

    const route = emitter.events.find((e) => e.name === 'kernel.routing_decision')
    const props = route!.props as { alternatives_considered: string[] }
    expect(Array.isArray(props.alternatives_considered)).toBe(true)
    // Phase 1 set must include MCP + the two facilitator rails. If
    // a future commit narrows this, the test will catch it.
    expect(props.alternatives_considered).toContain('mcp')
    expect(props.alternatives_considered).toContain('x402')
    expect(props.alternatives_considered).toContain('mpp')
  })

  it('emits adapter_error + adapter_latency_ms(success=false) and NO invocation_settled when validate-key rejects', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/sdk/validate-key'))
        return jsonResponse(
          { error: 'Invalid API key', code: 'INVALID_KEY' },
          401,
        )
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 5 },
    })
    const emitter = memoryKernelEmitter()
    const kernel = createDispatchKernel(sg, { emitter })

    const handler = vi.fn()
    await kernel.handle(mcpRequest(), handler)
    expect(handler).not.toHaveBeenCalled()

    const names = emitter.events.map((e) => e.name)
    // Pre-error events still fire because they're emitted before the
    // throw. adapter_error + adapter_latency_ms(success=false) follow.
    // invocation_settled MUST NOT appear — the meter never ran.
    expect(names).toContain('kernel.request_received')
    expect(names).toContain('kernel.routing_decision')
    expect(names).toContain('kernel.adapter_error')
    expect(names).toContain('kernel.adapter_latency_ms')
    expect(names).not.toContain('kernel.invocation_settled')

    const lat = emitter.events.find((e) => e.name === 'kernel.adapter_latency_ms')
    expect((lat!.props as { success: boolean }).success).toBe(false)

    const errEvt = emitter.events.find((e) => e.name === 'kernel.adapter_error')
    expect(errEvt).toBeDefined()
    const errProps = errEvt!.props as unknown as Record<string, unknown>
    expect(errProps.adapter).toBe('mcp')
    expect(typeof errProps.error_class).toBe('string')
    // sanitizer collapses unknown classes but a real Error subclass
    // name (InvalidKeyError) should pass through.
    expect(errProps.error_class).toBe('InvalidKeyError')
  })

  it("does NOT emit invocation_settled when meter returns success=false (won't skew settled-volume aggregate)", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/sdk/validate-key'))
        return jsonResponse({
          valid: true,
          consumerId: 'c',
          toolId: 't',
          keyId: 'k',
          balanceCents: 10_000,
        })
      if (url.endsWith('/api/sdk/meter'))
        return jsonResponse({
          success: false,
          remainingBalanceCents: 10_000,
          costCents: 0,
          invocationId: 'inv-failed',
        })
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 5 },
    })
    const emitter = memoryKernelEmitter()
    const kernel = createDispatchKernel(sg, { emitter })
    await kernel.handle(mcpRequest(), async () => ({}))

    const names = emitter.events.map((e) => e.name)
    expect(names).not.toContain('kernel.invocation_settled')
    // adapter_latency_ms still fires (success=true at the kernel level
    // — the pipeline didn't throw; it's the meter that flagged failure).
    expect(names).toContain('kernel.adapter_latency_ms')
  })

  it('default emitter (when options.emitter is unset) is a no-op — no exceptions on any path', async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/api/sdk/validate-key'))
        return jsonResponse({
          valid: true,
          consumerId: 'c',
          toolId: 't',
          keyId: 'k',
          balanceCents: 10_000,
        })
      if (url.endsWith('/api/sdk/meter'))
        return jsonResponse({
          success: true,
          remainingBalanceCents: 9_995,
          costCents: 5,
          invocationId: 'inv-noop',
        })
      return new Response('{}', { status: 404 })
    })

    const sg = settlegrid.init({
      toolSlug: 'emission-tool',
      pricing: { defaultCostCents: 5 },
    })
    // No emitter passed — kernel should default to noop and not throw.
    const kernel = createDispatchKernel(sg)
    const response = await kernel.handle(mcpRequest(), async () => ({}))
    expect(response.status).toBe(200)
  })
})
