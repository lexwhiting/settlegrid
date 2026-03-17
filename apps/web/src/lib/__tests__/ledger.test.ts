import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockTransaction } = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    transaction: mockTransaction,
    select: vi.fn(),
    insert: vi.fn(),
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

import { postLedgerEntry, postLedgerEntryAsync } from '@/lib/settlement/ledger'
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
