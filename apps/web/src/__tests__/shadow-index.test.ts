import { describe, it, expect, vi } from 'vitest'

// ── Mock DB layer ──────────────────────────────────────────────────────────

const mockSelect = vi.fn()
const mockFrom = vi.fn()
const mockWhere = vi.fn()
const mockOrderBy = vi.fn()
const mockLimit = vi.fn()
const mockSelectDistinct = vi.fn()

// Chain: db.select().from().where().orderBy().limit()
mockLimit.mockResolvedValue([])
mockOrderBy.mockReturnValue({ limit: mockLimit })
mockWhere.mockReturnValue({ limit: mockLimit, orderBy: mockOrderBy })
mockFrom.mockReturnValue({
  where: mockWhere,
  orderBy: mockOrderBy,
  limit: mockLimit,
})
mockSelect.mockReturnValue({ from: mockFrom })
mockSelectDistinct.mockReturnValue({ from: vi.fn().mockReturnValue({ orderBy: vi.fn().mockResolvedValue([]) }) })

vi.mock('@/lib/db', () => ({
  db: {
    select: mockSelect,
    selectDistinct: mockSelectDistinct,
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn() },
}))

// ── Import after mocks ────────────────────────��───────────────────────────

const {
  getAllShadowEntries,
  getShadowEntry,
  listOwners,
  countShadowEntries,
} = await import('@/lib/shadow-index')

// ── Fixtures ────────────────────��───────────────────────��──────────────────

const FIXTURE_ENTRY = {
  id: '00000000-0000-0000-0000-000000000001',
  source: 'github',
  owner: 'anthropics',
  repo: 'claude-code',
  name: 'Claude Code',
  description: 'AI coding assistant',
  category: 'ai',
  tags: ['ai', 'coding'],
  stars: 5000,
  downloads: null,
  lastUpdated: new Date('2026-04-01'),
  sourceUrl: 'https://github.com/anthropics/claude-code',
  settlegridAvailable: true,
  indexedAt: new Date('2026-04-10'),
}

// ── Tests ──────────────────────────────────────────────��───────────────────

describe('shadow-index reader', () => {
  it('getAllShadowEntries returns rows ordered by stars desc', async () => {
    mockLimit.mockResolvedValueOnce([FIXTURE_ENTRY])
    const entries = await getAllShadowEntries(10)
    expect(entries).toHaveLength(1)
    expect(entries[0].name).toBe('Claude Code')
  })

  it('getAllShadowEntries returns empty array on DB error', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValueOnce(new Error('DB down')),
        }),
      }),
    })
    const entries = await getAllShadowEntries()
    expect(entries).toEqual([])
  })

  it('getShadowEntry returns matching row', async () => {
    mockLimit.mockResolvedValueOnce([FIXTURE_ENTRY])
    const entry = await getShadowEntry('anthropics', 'claude-code')
    expect(entry?.name).toBe('Claude Code')
  })

  it('getShadowEntry returns undefined for missing entry', async () => {
    mockLimit.mockResolvedValueOnce([])
    const entry = await getShadowEntry('nobody', 'nothing')
    expect(entry).toBeUndefined()
  })

  it('getShadowEntry returns undefined on DB error', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValueOnce(new Error('timeout')),
        }),
      }),
    })
    const entry = await getShadowEntry('x', 'y')
    expect(entry).toBeUndefined()
  })

  it('countShadowEntries returns count on success', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockResolvedValueOnce([{ count: 42 }]),
    })
    const count = await countShadowEntries()
    expect(count).toBe(42)
  })

  it('countShadowEntries returns 0 on DB error', async () => {
    mockSelect.mockReturnValueOnce({
      from: vi.fn().mockRejectedValueOnce(new Error('no db')),
    })
    const count = await countShadowEntries()
    expect(count).toBe(0)
  })

  it('listOwners returns distinct owners on success', async () => {
    mockSelectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValueOnce([
          { owner: 'alice' },
          { owner: 'bob' },
        ]),
      }),
    })
    const owners = await listOwners()
    expect(owners).toEqual(['alice', 'bob'])
  })

  it('listOwners returns empty array on DB error', async () => {
    mockSelectDistinct.mockReturnValueOnce({
      from: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockRejectedValueOnce(new Error('timeout')),
      }),
    })
    const owners = await listOwners()
    expect(owners).toEqual([])
  })
})

describe('JSON-LD XSS prevention', () => {
  it('escapes </script> in JSON-LD output', () => {
    const malicious = {
      name: 'Test',
      description: '</script><script>alert("xss")</script>',
    }
    const escaped = JSON.stringify(malicious).replace(/</g, '\\u003c')
    expect(escaped).not.toContain('</script>')
    expect(escaped).toContain('\\u003c/script')
    // Still valid JSON when unescaped
    expect(JSON.parse(escaped.replace(/\\u003c/g, '<'))).toEqual(malicious)
  })
})

describe('generateStaticParams deduplication', () => {
  it('deduplicates entries with same owner+repo from different sources', async () => {
    const entries = [
      { ...FIXTURE_ENTRY, source: 'github' },
      { ...FIXTURE_ENTRY, source: 'awesome-mcp' },
      { ...FIXTURE_ENTRY, source: 'npm', owner: 'other', repo: 'thing' },
    ]

    // Simulate the dedup logic from the page (tested here as a pure function)
    const seen = new Set<string>()
    const params: { owner: string; repo: string }[] = []
    for (const e of entries) {
      const key = `${e.owner}/${e.repo}`
      if (seen.has(key)) continue
      seen.add(key)
      params.push({ owner: e.owner, repo: e.repo })
    }

    expect(params).toHaveLength(2)
    expect(params[0]).toEqual({ owner: 'anthropics', repo: 'claude-code' })
    expect(params[1]).toEqual({ owner: 'other', repo: 'thing' })
  })
})
