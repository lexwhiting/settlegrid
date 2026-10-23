/**
 * Founding Member grants (lib/founding.ts): a slot is taken when a developer's
 * first tool goes live, under an advisory lock, up to FOUNDING_MEMBER_LIMIT,
 * never for the system catalog principal, and never twice.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const { mockTx, mockDb, mockSql } = vi.hoisted(() => {
  const mockTx = {
    execute: vi.fn().mockResolvedValue(undefined),
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    limit: vi.fn(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
  }
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn(),
    transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb(mockTx)),
  }
  const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ sql: strings.join('?'), values }))
  return { mockTx, mockDb, mockSql }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  developers: {
    id: 'id',
    email: 'email',
    slug: 'slug',
    isFoundingMember: 'is_founding_member',
    foundingMemberAt: 'founding_member_at',
    updatedAt: 'updated_at',
  },
}))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  sql: mockSql,
}))

import {
  grantFoundingMemberIfEligible,
  countFoundingMembers,
  FOUNDING_MEMBER_LIMIT,
} from '../founding'
import { SYSTEM_DEVELOPER_SLUG } from '../system-principal'

/** tx.where is used by: dev lookup (chains to .limit), count (resolves), update (resolves). */
function txSees(dev: unknown | null, foundingCount?: number) {
  mockTx.where.mockReturnValueOnce(mockTx) // dev lookup → .limit()
  mockTx.limit.mockResolvedValueOnce(dev ? [dev] : [])
  if (foundingCount !== undefined) {
    mockTx.where.mockResolvedValueOnce([{ count: foundingCount }]) // count
    mockTx.where.mockResolvedValueOnce(undefined) // update
  }
}

const DEV = { id: 'dev-1', email: 'dev@example.com', slug: 'dev-one', isFoundingMember: false }

beforeEach(() => {
  vi.clearAllMocks()
  mockTx.select.mockReturnThis()
  mockTx.from.mockReturnThis()
  mockTx.update.mockReturnThis()
  mockTx.set.mockReturnThis()
  mockTx.where.mockReset()
  mockTx.limit.mockReset()
})

describe('grantFoundingMemberIfEligible', () => {
  it('takes the advisory lock inside a transaction before reading', async () => {
    txSees(DEV, 0)
    await grantFoundingMemberIfEligible('dev-1')

    expect(mockDb.transaction).toHaveBeenCalledTimes(1)
    expect(mockTx.execute).toHaveBeenCalledTimes(1)
    const lockSql = mockTx.execute.mock.calls[0][0] as { sql: string }
    expect(lockSql.sql).toContain('pg_advisory_xact_lock')
    expect(mockTx.execute.mock.invocationCallOrder[0]).toBeLessThan(
      mockTx.select.mock.invocationCallOrder[0],
    )
  })

  it('grants when under the limit', async () => {
    txSees(DEV, FOUNDING_MEMBER_LIMIT - 1)

    await expect(grantFoundingMemberIfEligible('dev-1')).resolves.toBe('granted')
    expect(mockTx.set).toHaveBeenCalledWith(
      expect.objectContaining({ isFoundingMember: true, foundingMemberAt: expect.any(Date) }),
    )
  })

  it('does not grant once the limit is reached', async () => {
    txSees(DEV, FOUNDING_MEMBER_LIMIT)

    await expect(grantFoundingMemberIfEligible('dev-1')).resolves.toBe('limit_reached')
    expect(mockTx.update).not.toHaveBeenCalled()
  })

  it('leaves an existing member untouched', async () => {
    txSees({ ...DEV, isFoundingMember: true })

    await expect(grantFoundingMemberIfEligible('dev-1')).resolves.toBe('already_member')
    expect(mockTx.update).not.toHaveBeenCalled()
  })

  it('never grants the system catalog principal', async () => {
    txSees({ ...DEV, slug: SYSTEM_DEVELOPER_SLUG })

    await expect(grantFoundingMemberIfEligible('dev-1')).resolves.toBe('system_principal')
    expect(mockTx.update).not.toHaveBeenCalled()
  })

  it('returns not_found for an unknown developer', async () => {
    txSees(null)

    await expect(grantFoundingMemberIfEligible('nope')).resolves.toBe('not_found')
    expect(mockTx.update).not.toHaveBeenCalled()
  })
})

describe('countFoundingMembers', () => {
  it('counts founding members and excludes the system principal by slug', async () => {
    mockDb.where.mockResolvedValueOnce([{ count: 42 }])

    await expect(countFoundingMembers()).resolves.toBe(42)

    const exclusion = mockSql.mock.results
      .map((r) => r.value as { sql: string; values: unknown[] })
      .find((v) => v.sql.includes('IS DISTINCT FROM'))
    expect(exclusion?.values).toContain(SYSTEM_DEVELOPER_SLUG)
  })
})

describe('sign-up no longer takes a founding slot', () => {
  it('auth/callback does not set isFoundingMember on new developer rows', () => {
    const src = readFileSync(resolve(__dirname, '../../app/auth/callback/route.ts'), 'utf8')
    expect(src).not.toMatch(/isFoundingMember/)
    expect(src).not.toMatch(/foundingMemberAt/)
  })
})
