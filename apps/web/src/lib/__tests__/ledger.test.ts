import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockTransaction, mockInsert } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockInsert: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mockTransaction,
    select: vi.fn(),
    insert: mockInsert,
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db/schema', () => ({
  accounts: {
    id: 'id',
    version: 'version',
    balanceCents: 'balance_cents',
    updatedAt: 'updated_at',
  },
  ledgerEntries: {
    id: 'id',
    accountId: 'account_id',
    entryType: 'entry_type',
    amountCents: 'amount_cents',
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  postLedgerEntry,
  postLedgerEntryAsync,
  recordSettlementEntry,
} from '@/lib/settlement/ledger'
import { logger } from '@/lib/logger'

describe('postLedgerEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects zero amount', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 0,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Ledger entry amount must be positive, got 0')
  })

  // P2.TAX1 — tax validation at the app layer (hostile-review (b))
  it('rejects negative taxCents', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'purchase',
        description: 'test',
        taxCents: -1,
      })
    ).rejects.toThrow('taxCents must be a non-negative integer')
  })

  it('rejects non-integer taxCents', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'purchase',
        description: 'test',
        taxCents: 1.5,
      })
    ).rejects.toThrow('taxCents must be a non-negative integer')
  })

  it('rejects NaN / Infinity taxCents', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'purchase',
        description: 'test',
        taxCents: NaN,
      })
    ).rejects.toThrow('taxCents must be a non-negative integer')
  })

  it('rejects taxCents>0 without taxJurisdiction (tax must be traceable)', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 1900,
        category: 'purchase',
        description: 'Builder plan',
        taxCents: 361,
      })
    ).rejects.toThrow('collected tax must be traceable to an authority')
  })

  it('rejects taxCents greater than amountCents (tax cannot exceed total)', async () => {
    // Hostile-review II: tax is a PORTION of the total charge.
    // A payload with amountCents=100, taxCents=500 is corrupt
    // (wrong field mapping, upstream bug, etc.). Fail fast at the
    // app layer instead of writing garbage to the ledger.
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'purchase',
        description: 'test',
        taxCents: 500,
        taxJurisdiction: 'DE',
      })
    ).rejects.toThrow(/tax cannot exceed the total charge/)
  })

  it('accepts taxCents exactly equal to amountCents (edge case: fully-tax entry)', async () => {
    // Unusual but legal: a credit-note entry where the principal
    // was previously recorded and this entry is tax-only remittance.
    // Should not throw at validation.
    mockTransaction.mockImplementation(async (cb) => {
      return cb({
        select: () => ({
          from: () => ({
            where: () => ({ limit: () => [{ id: 'acct-1', version: 1, balanceCents: 0 }] }),
          }),
        }),
        insert: () => ({ values: () => ({ returning: () => [{ id: 'entry-1' }] }) }),
        update: () => ({
          set: () => ({
            where: () => ({ returning: () => [{ id: 'acct-1' }] }),
          }),
        }),
      })
    })
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'purchase',
        description: 'tax-only',
        taxCents: 100,
        taxJurisdiction: 'DE',
      })
    ).resolves.toBeDefined()
  })

  it('accepts taxCents=0 without taxJurisdiction (non-tax entries)', async () => {
    // Should not throw at the validation layer; the actual DB write
    // is still mocked so we just check that validation passes.
    mockTransaction.mockImplementation(async (cb) => {
      return cb({
        select: () => ({
          from: () => ({
            where: () => ({
              limit: () => [
                { id: 'acct-1', version: 1, balanceCents: 1000 },
              ],
            }),
          }),
        }),
        insert: () => ({
          values: () => ({
            returning: () => [{ id: 'entry-1' }],
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () => [{ id: 'acct-1' }],
            }),
          }),
        }),
      })
    })
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'metering',
        description: 'per-call fee',
      })
    ).resolves.toBeDefined()
  })

  it('rejects negative amount', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: -5,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Ledger entry amount must be positive, got -5')
  })

  it('rejects same debit and credit account', async () => {
    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-1',
        amountCents: 100,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Debit and credit accounts must be different')
  })

  it('throws on missing debit account', async () => {
    // Mock transaction to execute the callback
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // empty = not found
            }),
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
      }
      return cb(tx)
    })

    await expect(
      postLedgerEntry({
        debitAccountId: 'missing-acct',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Debit account not found: missing-acct')
  })

  it('throws on missing credit account', async () => {
    let callCount = 0
    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                callCount++
                if (callCount === 1) {
                  return Promise.resolve([{ id: 'acct-1', version: 0, balanceCents: 1000 }])
                }
                return Promise.resolve([]) // credit account not found
              }),
            }),
          }),
        }),
        insert: vi.fn(),
        update: vi.fn(),
      }
      return cb(tx)
    })

    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-1',
        creditAccountId: 'missing-acct',
        amountCents: 100,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Credit account not found: missing-acct')
  })

  it('creates balanced entries and updates accounts in transaction', async () => {
    const insertedEntries: Record<string, unknown>[] = []
    const updatedAccounts: boolean[] = []
    let selectCallCount = 0

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++
                if (selectCallCount === 1) {
                  return Promise.resolve([{ id: 'acct-debit', version: 3, balanceCents: 5000 }])
                }
                return Promise.resolve([{ id: 'acct-credit', version: 7, balanceCents: 1000 }])
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((vals) => {
            insertedEntries.push(vals)
            return {
              returning: vi.fn().mockResolvedValue([{ id: `entry-${insertedEntries.length}` }]),
            }
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockImplementation(() => {
                updatedAccounts.push(true)
                return Promise.resolve([{ id: `acct-${updatedAccounts.length}` }])
              }),
            }),
          }),
        }),
      }
      return cb(tx)
    })

    const result = await postLedgerEntry({
      debitAccountId: 'acct-debit',
      creditAccountId: 'acct-credit',
      amountCents: 500,
      category: 'metering',
      description: 'Tool invocation charge',
    })

    expect(result.debitEntryId).toBe('entry-1')
    expect(result.creditEntryId).toBe('entry-2')
    expect(insertedEntries).toHaveLength(2)
    expect(insertedEntries[0].entryType).toBe('debit')
    expect(insertedEntries[1].entryType).toBe('credit')
    expect(insertedEntries[0].amountCents).toBe(500)
    expect(insertedEntries[1].amountCents).toBe(500)
    expect(updatedAccounts).toHaveLength(2)
  })

  it('throws on optimistic lock failure (debit)', async () => {
    let selectCallCount = 0

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++
                if (selectCallCount === 1) {
                  return Promise.resolve([{ id: 'acct-debit', version: 3, balanceCents: 5000 }])
                }
                return Promise.resolve([{ id: 'acct-credit', version: 7, balanceCents: 1000 }])
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ id: 'entry-x' }]),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([]), // empty = lock failed
            }),
          }),
        }),
      }
      return cb(tx)
    })

    await expect(
      postLedgerEntry({
        debitAccountId: 'acct-debit',
        creditAccountId: 'acct-credit',
        amountCents: 500,
        category: 'metering',
        description: 'test',
      })
    ).rejects.toThrow('Optimistic lock failed on debit account acct-debit')
  })

  it('stores category and description correctly', async () => {
    const insertedEntries: Record<string, unknown>[] = []
    let selectCallCount = 0

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++
                return Promise.resolve([{ id: `acct-${selectCallCount}`, version: 0, balanceCents: 10000 }])
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((vals) => {
            insertedEntries.push(vals)
            return { returning: vi.fn().mockResolvedValue([{ id: 'e-1' }]) }
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'a-1' }]),
            }),
          }),
        }),
      }
      return cb(tx)
    })

    await postLedgerEntry({
      debitAccountId: 'acct-1',
      creditAccountId: 'acct-2',
      amountCents: 100,
      category: 'purchase',
      description: 'Credit top-up',
      metadata: { source: 'stripe' },
      operationId: 'op-123',
      batchId: 'batch-456',
    })

    expect(insertedEntries[0].category).toBe('purchase')
    expect(insertedEntries[0].description).toBe('Credit top-up')
    expect(insertedEntries[0].metadata).toEqual({ source: 'stripe' })
    expect(insertedEntries[0].operationId).toBe('op-123')
    expect(insertedEntries[0].batchId).toBe('batch-456')
  })

  it('uses USD as default currency', async () => {
    const insertedEntries: Record<string, unknown>[] = []
    let selectCallCount = 0

    mockTransaction.mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockImplementation(() => {
                selectCallCount++
                return Promise.resolve([{ id: `a-${selectCallCount}`, version: 0, balanceCents: 10000 }])
              }),
            }),
          }),
        }),
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockImplementation((vals) => {
            insertedEntries.push(vals)
            return { returning: vi.fn().mockResolvedValue([{ id: 'e-1' }]) }
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([{ id: 'a-1' }]),
            }),
          }),
        }),
      }
      return cb(tx)
    })

    await postLedgerEntry({
      debitAccountId: 'acct-1',
      creditAccountId: 'acct-2',
      amountCents: 100,
      category: 'metering',
      description: 'test',
    })

    expect(insertedEntries[0].currencyCode).toBe('USD')
  })
})

describe('postLedgerEntryAsync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('does not throw on failure (logs error)', async () => {
    mockTransaction.mockRejectedValue(new Error('DB down'))

    // Should not throw
    postLedgerEntryAsync({
      debitAccountId: 'acct-1',
      creditAccountId: 'acct-2',
      amountCents: 100,
      category: 'metering',
      description: 'test',
    })

    // Wait for the async error to be caught and logged
    await new Promise((r) => setTimeout(r, 50))

    expect(logger.error).toHaveBeenCalledWith(
      'ledger.post_entry_failed',
      expect.objectContaining({
        debitAccountId: 'acct-1',
        creditAccountId: 'acct-2',
        amountCents: 100,
        category: 'metering',
      }),
      expect.any(Error)
    )
  })
})

// P3.K4 (A1) — recordSettlementEntry runs the REAL canonical recordLedgerEntry
// validator + the real Drizzle row mapping against a captured db.insert. The
// facilitator route tests mock recordSettlementEntryAsync, so THESE are the
// only tests that exercise the validator the routes' inputs must satisfy — in
// particular the 'settled' ⇒ settledAt contract that a mock-only assertion
// cannot catch.
describe('recordSettlementEntry (facilitator-rail settlement rows)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  /** Capture rows handed to db.insert(...).values(...).onConflictDoNothing(). */
  function captureInsert(): {
    rows: Record<string, unknown>[]
    onConflictDoNothing: ReturnType<typeof vi.fn>
  } {
    const rows: Record<string, unknown>[] = []
    const onConflictDoNothing = vi.fn().mockResolvedValue(undefined)
    mockInsert.mockReturnValue({
      values: vi.fn().mockImplementation((vals: Record<string, unknown>) => {
        rows.push(vals)
        return { onConflictDoNothing }
      }),
    })
    return { rows, onConflictDoNothing }
  }

  it("accepts the ap2 'settled' shape (with settledAt) and writes a settled row", async () => {
    const { rows } = captureInsert()
    await recordSettlementEntry({
      invocationId: 'tx-9',
      rail: 'ap2',
      protocol: 'ap2',
      amountCents: 50,
      currency: 'USD',
      takeBps: 0,
      status: 'settled',
      settledAt: '2026-05-30T16:00:00.000Z',
      accountId: 'dev-uuid-1',
      metadata: { method: 'demo.invocation', settlementType: 'real-time' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].settlementStatus).toBe('settled')
    expect(rows[0].settledAt).toBeInstanceOf(Date)
    expect(rows[0].rail).toBe('ap2')
    expect(rows[0].accountId).toBe('dev-uuid-1')
  })

  it("REJECTS a 'settled' row missing settledAt (the contract the ap2 route must satisfy)", async () => {
    captureInsert()
    await expect(
      recordSettlementEntry({
        invocationId: 'tx-9',
        rail: 'ap2',
        protocol: 'ap2',
        amountCents: 50,
        currency: 'USD',
        takeBps: 0,
        status: 'settled',
        // settledAt deliberately omitted — must throw, not silently no-op.
        accountId: 'dev-uuid-1',
      }),
    ).rejects.toThrow(/settledAt/)
  })

  it("accepts the circle-nano 'pending' shape (settledAt null; USDC → legacy USD)", async () => {
    const { rows } = captureInsert()
    await recordSettlementEntry({
      invocationId: 'circle-nano:eip155:8453:0xabc:0xdef',
      rail: 'circle-nano',
      protocol: 'circle-nano',
      amountCents: 50,
      currency: 'USDC',
      takeBps: 0,
      status: 'pending',
      externalRef: null,
      accountId: 'dev-uuid-1',
      metadata: { method: 'demo.invocation', settlementType: 'batched' },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].settlementStatus).toBe('pending')
    expect(rows[0].settledAt).toBeNull()
    expect(rows[0].rail).toBe('circle-nano')
    // legacy varchar(3) currency_code: 'USDC' → 'USD'
    expect(rows[0].currencyCode).toBe('USD')
  })

  it('REJECTS a zero amount (the cost>0 guard the routes apply mirrors this)', async () => {
    captureInsert()
    await expect(
      recordSettlementEntry({
        invocationId: 'tx-0',
        rail: 'ap2',
        protocol: 'ap2',
        amountCents: 0,
        currency: 'USD',
        takeBps: 0,
        status: 'settled',
        settledAt: '2026-05-30T16:00:00.000Z',
        accountId: 'dev-uuid-1',
      }),
    ).rejects.toThrow(/amountCents/)
  })

  it('derives a STABLE deterministic id from invocationId so re-settles dedupe', async () => {
    const { rows, onConflictDoNothing } = captureInsert()
    const input = {
      invocationId: 'circle-nano:eip155:8453:0xabc:0xdef',
      rail: 'circle-nano',
      protocol: 'circle-nano',
      amountCents: 50,
      currency: 'USDC',
      takeBps: 0,
      status: 'pending' as const,
      externalRef: null,
      accountId: 'dev-uuid-1',
    }
    await recordSettlementEntry(input)
    await recordSettlementEntry(input)
    expect(rows).toHaveLength(2)
    // Same invocationId ⇒ same PK ⇒ Postgres ON CONFLICT DO NOTHING dedupes.
    expect(rows[0].id).toBe(rows[1].id)
    expect(rows[0].id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    )
    expect(onConflictDoNothing).toHaveBeenCalledTimes(2)
  })

  it('derives DIFFERENT ids for different invocationIds', async () => {
    const { rows } = captureInsert()
    const base = {
      rail: 'ap2',
      protocol: 'ap2',
      amountCents: 50,
      currency: 'USD',
      takeBps: 0,
      status: 'settled' as const,
      settledAt: '2026-05-30T16:00:00.000Z',
      accountId: 'dev-uuid-1',
    }
    await recordSettlementEntry({ ...base, invocationId: 'tx-A' })
    await recordSettlementEntry({ ...base, invocationId: 'tx-B' })
    expect(rows[0].id).not.toBe(rows[1].id)
  })
})
