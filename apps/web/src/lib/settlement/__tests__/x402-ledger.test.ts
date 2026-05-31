/**
 * B1.2 — x402 unified-ledger settlement-row builder.
 *
 * Behavioral coverage of the guard + field-mapping + dedup-key logic (the
 * bug-prone part), unit-testable because buildX402SettlementRow is pure. The
 * proxy route handler that calls it is NOT handler-tested (too-heavy deps — see
 * billing-credits.test.ts in the proxy route's __tests__); the final
 * `describe` instead source-pins that handleX402Proxy actually wires the
 * builder + the writer, so a regression that drops the call fails loudly.
 *
 * The row is recorded 'pending' (not 'settled'): the proxy path only has a
 * BROADCAST txHash, never a confirmed receipt, so the B1.4 reconciler flips it.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { buildX402SettlementRow, type X402SettlementInputs } from '../x402-ledger'

const TX = '0xabc0000000000000000000000000000000000000000000000000000000000def'
const DEV = 'dev-123'
const VALID: X402SettlementInputs = {
  txHash: TX,
  network: 'eip155:8453',
  scheme: 'exact',
  amountUsdc: '50000',
  payerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
}

describe('buildX402SettlementRow — records a PENDING row for a broadcast x402 settlement', () => {
  it('maps all fields for a valid settlement', () => {
    const row = buildX402SettlementRow(VALID, 'my-tool', DEV, 5)
    expect(row).not.toBeNull()
    expect(row).toMatchObject({
      invocationId: `x402:eip155:8453:${TX}`,
      rail: 'x402',
      protocol: 'x402',
      amountCents: 5, // the billed cost, NOT the on-chain USDC amount
      currency: 'USDC',
      takeBps: 0,
      status: 'pending',
      externalRef: TX,
      accountId: DEV,
    })
    expect(row?.metadata).toEqual({
      network: 'eip155:8453',
      scheme: 'exact',
      amountUsdc: '50000',
      payerAddress: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
      settlementType: 'on-chain',
    })
    // externalRef pins the row to the broadcast tx; invocationId embeds it too,
    // so the B1.4 reconciler can locate + confirm + flip it.
    expect(row?.externalRef).toBe(TX)
    expect(row?.invocationId).toContain(TX)
  })

  it('a pending row carries NO settledAt (the reconciler sets it on the flip)', () => {
    const row = buildX402SettlementRow(VALID, 'my-tool', DEV, 5)
    // A 'settled' row MUST carry settledAt (validator throws); a 'pending' row
    // MUST NOT claim a settlement time it hasn't reached.
    expect(row?.status).toBe('pending')
    expect(row?.settledAt ?? null).toBeNull()
  })

  it('dedup key is settlement-rooted: same tx → same key regardless of the calling tool', () => {
    const a = buildX402SettlementRow(VALID, 'tool-a', DEV, 5)
    const b = buildX402SettlementRow(VALID, 'tool-b', 'dev-999', 9)
    // Keyed on network+txHash only, so a settle retry maps to the same PK →
    // ON CONFLICT DO NOTHING (and the reconciler matches the same operation_id).
    expect(a?.invocationId).toBe(b?.invocationId)
  })

  it('falls back to "unknown" network in the key but stays unique via txHash', () => {
    const row = buildX402SettlementRow({ txHash: TX }, 'my-tool', DEV, 5)
    expect(row?.invocationId).toBe(`x402:unknown:${TX}`)
    expect(row?.metadata).toMatchObject({ network: null, scheme: null, amountUsdc: null })
  })
})

describe('buildX402SettlementRow — records NOTHING when there is no attributable settlement', () => {
  it('returns null when there is no on-chain txHash (e.g. local structural acceptance)', () => {
    expect(buildX402SettlementRow({ network: 'eip155:8453' }, 'my-tool', DEV, 5)).toBeNull()
  })

  it('returns null for a zero-cost call', () => {
    expect(buildX402SettlementRow(VALID, 'my-tool', DEV, 0)).toBeNull()
  })

  it('returns null for a negative cost', () => {
    expect(buildX402SettlementRow(VALID, 'my-tool', DEV, -5)).toBeNull()
  })

  it('returns null when there is no developer to attribute the credit to', () => {
    expect(buildX402SettlementRow(VALID, 'my-tool', undefined, 5)).toBeNull()
    expect(buildX402SettlementRow(VALID, 'my-tool', '', 5)).toBeNull()
  })
})

describe('B1.2 wiring — handleX402Proxy records the settlement (source-pin)', () => {
  // The proxy route is not handler-tested (heavy deps); pin that the wiring
  // exists so a refactor can't silently drop the x402 ledger write.
  const src = readFileSync(
    resolve(process.cwd(), 'src/app/api/proxy/[slug]/route.ts'),
    'utf8',
  )

  it('imports the builder + the fire-and-forget writer', () => {
    expect(src).toMatch(/import\s*\{\s*buildX402SettlementRow\s*\}\s*from\s*'@\/lib\/settlement\/x402-ledger'/)
    expect(src).toMatch(/import\s*\{\s*recordSettlementEntryAsync\s*\}\s*from\s*'@\/lib\/settlement\/ledger'/)
  })

  it('builds the row from x402Result and records it when non-null, before forwardAndBill', () => {
    expect(src).toContain('buildX402SettlementRow(')
    expect(src).toMatch(/if\s*\(\s*x402SettlementRow\s*\)\s*recordSettlementEntryAsync\(\s*x402SettlementRow\s*\)/)
    // Recorded ahead of the upstream forward so a forward error can't lose it.
    const buildIdx = src.indexOf('buildX402SettlementRow(\n')
    const x402ForwardIdx = src.indexOf("forwardAndBill(\n    request, toolRow, 'x402'")
    expect(buildIdx).toBeGreaterThan(-1)
    expect(x402ForwardIdx).toBeGreaterThan(-1)
    expect(buildIdx).toBeLessThan(x402ForwardIdx)
  })
})
