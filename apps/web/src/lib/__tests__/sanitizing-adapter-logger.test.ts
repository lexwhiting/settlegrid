/**
 * V-N3-log-redaction (B3) — the behavioral canary for the sanitizing-adapter seam
 * (`@/lib/sanitizing-adapter-logger`). Review #2 found the seam shipped with ZERO
 * runtime test: the only referent was a STATIC text-scan in the grep-guard, so the
 * H1+M1 fix surface had no green pin and B1 (the numeric drain nonce) + B4 (the raw
 * channel address) leaked invisibly. This feeds the THREE real adapter metas through
 * `createSanitizingAdapterLogger().{info,warn,error}` (with `@/lib/logger` mocked),
 * asserting NO raw payer / nonce / channel-address survives and the correlation keys
 * (`toolSlug`, `amountBaseUnits`, `network`) pass through. It goes RED on the pre-fix
 * seam (numeric `nonce` skipped → forwarded; `channelId` not stripped) and GREEN now.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockInfo, mockWarn, mockError } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
}))

// The factory imports `{ logger } from './logger'`, which resolves to the same
// module as `@/lib/logger` — mocking the alias intercepts the factory's import.
vi.mock('@/lib/logger', () => ({
  logger: { info: mockInfo, warn: mockWarn, error: mockError },
}))

import { createSanitizingAdapterLogger } from '@/lib/sanitizing-adapter-logger'

const PAYER = '0x' + 'ab'.repeat(20) // 40-hex EVM payer (raw)
const CHANNEL = '0x' + 'bc'.repeat(20) // 40-hex drain channel contract address (raw)
const NONCE_HEX = '0x' + 'cd'.repeat(32) // 64-hex nonce in string form

describe('createSanitizingAdapterLogger — seam strips payer/nonce/channel, keeps correlation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('x402 (payment_accepted_local): strips raw payerAddress, keeps toolSlug/network/amountBaseUnits', () => {
    const log = createSanitizingAdapterLogger()
    // The real `packages/mcp/src/adapters/x402.ts` meta.
    log.info('x402.payment_accepted_local', {
      toolSlug: 'weather',
      payerAddress: PAYER,
      network: 'eip155:8453',
      scheme: 'exact',
      amountBaseUnits: '1000000',
    })
    expect(mockInfo).toHaveBeenCalledOnce()
    const [event, meta] = mockInfo.mock.calls[0] as [string, Record<string, unknown>]
    expect(event).toBe('x402.payment_accepted_local')
    expect(JSON.stringify(meta)).not.toContain(PAYER) // raw payer never egresses
    expect(meta.payerAddress).toBe('0x<redacted>')
    expect(meta.toolSlug).toBe('weather') // correlation preserved
    expect(meta.network).toBe('eip155:8453')
    expect(meta.amountBaseUnits).toBe('1000000')
  })

  it('drain (payment_accepted): DROPS the numeric nonce (B1) + strips channelId (B4) + payerAddress', () => {
    const log = createSanitizingAdapterLogger()
    // The real `packages/mcp/src/adapters/drain.ts` meta — `nonce` is a NUMBER.
    log.info('drain.payment_accepted', {
      toolSlug: 'drain-tool',
      channelId: CHANNEL,
      payerAddress: PAYER,
      amountBaseUnits: '500000',
      nonce: 42,
    })
    expect(mockInfo).toHaveBeenCalledOnce()
    const [event, meta] = mockInfo.mock.calls[0] as [string, Record<string, unknown>]
    expect(event).toBe('drain.payment_accepted')
    const blob = JSON.stringify(meta)
    expect(blob).not.toContain(PAYER) // raw payer never egresses
    expect(blob).not.toContain(CHANNEL) // raw channel address never egresses (B4)
    expect(meta.payerAddress).toBe('0x<redacted>')
    expect(meta.channelId).toBe('0x<redacted>')
    expect(meta.nonce).toBeUndefined() // B1: the numeric nonce is DROPPED, not coerced to '42'
    expect('nonce' in meta).toBe(false)
    expect(meta.toolSlug).toBe('drain-tool') // correlation preserved
    expect(meta.amountBaseUnits).toBe('500000')
  })

  it('circle-nano (proof_structurally_valid): strips raw `payer`, keeps toolSlug/amountBaseUnits', () => {
    const log = createSanitizingAdapterLogger()
    // The real `packages/mcp/src/adapters/circle-nano.ts` meta.
    log.info('circle_nano.proof_structurally_valid', {
      toolSlug: 'cn-tool',
      payer: PAYER,
      amountBaseUnits: '1',
    })
    const [, meta] = mockInfo.mock.calls[0] as [string, Record<string, unknown>]
    expect(JSON.stringify(meta)).not.toContain(PAYER)
    expect(meta.payer).toBe('0x<redacted>')
    expect(meta.toolSlug).toBe('cn-tool')
    expect(meta.amountBaseUnits).toBe('1')
  })

  it('drops a NON-STRING value under ANY payer key (bigint / object), not just the numeric nonce (B1)', () => {
    const log = createSanitizingAdapterLogger()
    log.warn('drain.payment_accepted', {
      toolSlug: 'drain-tool',
      nonce: 7n, // bigint — String(7n) === '7' would also escape redactLogString
      payer: { address: PAYER }, // object — String({}) === '[object Object]'
      amountBaseUnits: '9',
    })
    const [, meta] = mockWarn.mock.calls[0] as [string, Record<string, unknown>]
    expect('nonce' in meta).toBe(false)
    expect('payer' in meta).toBe(false)
    expect(JSON.stringify(meta)).not.toContain(PAYER)
    expect(meta.toolSlug).toBe('drain-tool')
    expect(meta.amountBaseUnits).toBe('9')
  })

  it('the error channel forwards the err 3rd arg through and sanitizes meta', () => {
    const log = createSanitizingAdapterLogger()
    const err = new Error('boom')
    log.error('drain.payment_accepted', { payerAddress: PAYER, nonce: 42, toolSlug: 't' }, err)
    expect(mockError).toHaveBeenCalledOnce()
    const [event, meta, fwdErr] = mockError.mock.calls[0] as [string, Record<string, unknown>, unknown]
    expect(event).toBe('drain.payment_accepted')
    expect(meta.payerAddress).toBe('0x<redacted>')
    expect('nonce' in meta).toBe(false) // B1: numeric nonce dropped on the err channel too
    expect(meta.toolSlug).toBe('t')
    expect(fwdErr).toBe(err) // the err passes through to emit()'s central channel-B sanitizer
  })

  it('a string nonce/op_id under a payer key IS redacted (the string branch still works)', () => {
    const log = createSanitizingAdapterLogger()
    log.info('drain.payment_accepted', { toolSlug: 't', nonce: NONCE_HEX, amountBaseUnits: '3' })
    const [, meta] = mockInfo.mock.calls[0] as [string, Record<string, unknown>]
    expect(meta.nonce).toBe('0x<redacted>') // a 64-hex string nonce → redacted (not dropped)
    expect(JSON.stringify(meta)).not.toContain('cd'.repeat(32))
    expect(meta.toolSlug).toBe('t')
  })

  it('forwards a clean meta BY REFERENCE (no payer key present) and an undefined meta as {}', () => {
    const log = createSanitizingAdapterLogger()
    const clean = { toolSlug: 't', amountBaseUnits: '5' }
    log.info('drain.quote_issued', clean)
    const [, meta] = mockInfo.mock.calls[0] as [string, Record<string, unknown>]
    expect(meta).toBe(clean) // zero-overhead pass-through preserved
    log.info('drain.ping')
    expect(mockInfo.mock.calls[1][1]).toEqual({}) // undefined meta → {}
  })
})
