/**
 * findFallbackTool never picks a tool owned by an internal test-only account.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockDb, andArgs, EXCLUSION } = vi.hoisted(() => {
  const EXCLUSION = { exclusion: 'internal-test-tools' }
  const andArgs: unknown[][] = []
  const mockDb = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn(),
  }
  for (const key of ['select', 'from', 'where', 'orderBy'] as const) mockDb[key].mockReturnValue(mockDb)
  return { mockDb, andArgs, EXCLUSION }
})

vi.mock('@/lib/db', () => ({ db: mockDb }))
vi.mock('@/lib/db/schema', () => ({
  tools: { id: 'id', slug: 'slug', name: 'name', proxyEndpoint: 'proxy_endpoint', category: 'category', status: 'status', totalInvocations: 'total_invocations' },
  consumers: {},
  consumerToolBalances: {},
}))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }))
vi.mock('@/lib/marketplace-visibility', () => ({ excludeInternalTestToolsSql: () => EXCLUSION }))
vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => { andArgs.push(args); return { and: args } }),
  eq: vi.fn((a: unknown, b: unknown) => ({ eq: [a, b] })),
  ne: vi.fn((a: unknown, b: unknown) => ({ ne: [a, b] })),
  isNotNull: vi.fn((a: unknown) => ({ isNotNull: a })),
  desc: vi.fn((a: unknown) => ({ desc: a })),
  sql: Object.assign(vi.fn(), { raw: vi.fn() }),
}))

import { findFallbackTool } from '../failover'

describe('findFallbackTool', () => {
  beforeEach(() => {
    andArgs.length = 0
    mockDb.limit.mockReset()
  })

  it('excludes internal test-only tools from fallback candidates', async () => {
    mockDb.limit.mockResolvedValueOnce([{ id: 't2', slug: 'other-tool', name: 'Other', proxyEndpoint: 'https://example.com/api' }])

    const result = await findFallbackTool('original-tool', 'data')

    expect(result?.slug).toBe('other-tool')
    expect(andArgs).toHaveLength(1)
    expect(andArgs[0]).toContainEqual(EXCLUSION)
  })

  it('returns null without querying when the tool has no category', async () => {
    await expect(findFallbackTool('original-tool', null)).resolves.toBeNull()
    expect(mockDb.limit).not.toHaveBeenCalled()
  })
})
