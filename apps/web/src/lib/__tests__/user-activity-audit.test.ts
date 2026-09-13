import { describe, it, expect } from 'vitest'
import {
  looksLikeTestEmail,
  classifyAccount,
  partitionAccounts,
  countSince,
  maskEmail,
  formatUsd,
  daysAgo,
  verdict,
} from '@/lib/user-activity-audit'

describe('looksLikeTestEmail', () => {
  it.each([
    'test@example.com',
    'alice+signup@gmail.com',
    'test1@gmail.com',
    'qa.bob@company.io',
    'dev@acmecorp.test',
    'someone@mailinator.com',
    'foo.test@gmail.com',
  ])('flags %s as test-looking', (e) => {
    expect(looksLikeTestEmail(e)).toBe(true)
  })

  it.each([
    'flanneryewens39@outlook.com',
    'benjamin@humanmirror.fr',
    'contest.winner@gmail.com', // "test" inside a word is not a fixture marker
    'attestation@bank.com',
    'latest.news@site.org',
  ])('keeps %s as a real-looking address', (e) => {
    expect(looksLikeTestEmail(e)).toBe(false)
  })

  it('treats missing or malformed emails as test-looking (fail-visible)', () => {
    expect(looksLikeTestEmail(null)).toBe(true)
    expect(looksLikeTestEmail('')).toBe(true)
    expect(looksLikeTestEmail('no-at-sign')).toBe(true)
  })
})

describe('classifyAccount / partitionAccounts', () => {
  it('ranks internal above test-looking above external', () => {
    expect(classifyAccount('lexwhiting@gmail.com')).toBe('internal')
    expect(classifyAccount('ops@settlegrid.ai')).toBe('internal')
    expect(classifyAccount('test@example.com')).toBe('test-looking')
    expect(classifyAccount('real.person@outlook.com')).toBe('external')
  })

  it('partitions rows without dropping any', () => {
    const rows = [
      { id: '1', email: 'lexwhiting365@gmail.com', createdAt: '2026-06-01' },
      { id: '2', email: 'test+x@example.com', createdAt: '2026-06-01' },
      { id: '3', email: 'person@outlook.com', createdAt: '2026-06-01' },
      { id: '4', email: 'system@settlegrid.com', createdAt: '2026-06-01' },
    ]
    const p = partitionAccounts(rows)
    expect(p.internal.map((r) => r.id)).toEqual(['1', '4'])
    expect(p.testLooking.map((r) => r.id)).toEqual(['2'])
    expect(p.external.map((r) => r.id)).toEqual(['3'])
    expect(p.internal.length + p.testLooking.length + p.external.length).toBe(rows.length)
  })
})

describe('countSince', () => {
  const now = new Date('2026-09-13T12:00:00Z')
  it('counts rows at or after the cutoff and ignores bad dates', () => {
    const rows = [
      { id: 'a', email: 'a@x.com', createdAt: '2026-09-10T00:00:00Z' },
      { id: 'b', email: 'b@x.com', createdAt: '2026-08-01T00:00:00Z' },
      { id: 'c', email: 'c@x.com', createdAt: 'not-a-date' },
      { id: 'd', email: 'd@x.com', createdAt: new Date('2026-09-13T11:59:00Z') },
    ]
    expect(countSince(rows, 7, now)).toBe(2)
    expect(countSince(rows, 90, now)).toBe(3)
  })
})

describe('formatting helpers', () => {
  it('masks emails but keeps the domain recognisable', () => {
    expect(maskEmail('flanneryewens39@outlook.com')).toBe('f******@outlook.com')
    expect(maskEmail('ab@x.io')).toBe('a**@x.io')
    expect(maskEmail(null)).toBe('(none)')
    expect(maskEmail('@bad')).toBe('***')
  })

  it('formats cents as USD and handles numeric strings from SQL', () => {
    expect(formatUsd(63000)).toBe('$630.00')
    expect(formatUsd('903000')).toBe('$9,030.00')
    expect(formatUsd(null)).toBe('$0.00')
  })

  it('computes whole days ago', () => {
    const now = new Date('2026-09-13T12:00:00Z')
    expect(daysAgo('2026-03-25T00:00:00Z', now)).toBe(172)
    expect(daysAgo(null, now)).toBeNull()
  })
})

describe('verdict', () => {
  const base = {
    externalDevSignups30d: 0,
    externalConsumerSignups30d: 0,
    realInvocations30d: 0,
    completedPurchases30d: 0,
    lastRealInvocationDaysAgo: null,
  }
  it('is DORMANT with nothing in 30 days', () => {
    expect(verdict(base)).toMatch(/^DORMANT/)
  })
  it('is SIGNUPS WITHOUT USAGE when only accounts arrived', () => {
    expect(verdict({ ...base, externalDevSignups30d: 3, lastRealInvocationDaysAgo: 172 })).toMatch(
      /^SIGNUPS WITHOUT USAGE.*172 days ago/,
    )
  })
  it('is USAGE WITHOUT REVENUE with invocations but no purchases', () => {
    expect(verdict({ ...base, realInvocations30d: 12 })).toMatch(/^USAGE WITHOUT REVENUE/)
  })
  it('is ACTIVE with both', () => {
    expect(verdict({ ...base, realInvocations30d: 12, completedPurchases30d: 1 })).toMatch(/^ACTIVE/)
  })
})
