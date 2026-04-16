import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the meilisearch module before importing the client
const mockSearch = vi.fn()
vi.mock('meilisearch', () => ({
  Meilisearch: vi.fn().mockImplementation(() => ({
    index: () => ({ search: mockSearch }),
  })),
}))

// Mock env.ts so the client sees search as enabled
vi.mock('@/env', () => ({
  MEILI_URL: 'https://test.meili.dev',
  MEILI_SEARCH_KEY: 'test-search-key',
  SEARCH_ENABLED: true,
}))

// Dynamic import so mocks are applied first
const { searchTemplates, sanitizeHighlight } = await import('@/lib/meilisearch-client')

describe('meilisearch-client', () => {
  beforeEach(() => {
    mockSearch.mockReset()
    mockSearch.mockResolvedValue({ hits: [], estimatedTotalHits: 0 })
  })

  it('passes query to Meilisearch search', async () => {
    await searchTemplates('weather')

    expect(mockSearch).toHaveBeenCalledWith('weather', expect.objectContaining({
      limit: 20,
      attributesToHighlight: ['name', 'description'],
    }))
  })

  it('builds category filter correctly', async () => {
    await searchTemplates('api', { category: 'devtools' })

    expect(mockSearch).toHaveBeenCalledWith('api', expect.objectContaining({
      filter: 'category = "devtools"',
    }))
  })

  it('builds tag filter with OR logic', async () => {
    await searchTemplates('data', { tags: ['weather', 'api'] })

    expect(mockSearch).toHaveBeenCalledWith('data', expect.objectContaining({
      filter: '(tags = "weather" OR tags = "api")',
    }))
  })

  it('combines category and tag filters with AND', async () => {
    await searchTemplates('search', {
      category: 'data',
      tags: ['api'],
    })

    expect(mockSearch).toHaveBeenCalledWith('search', expect.objectContaining({
      filter: 'category = "data" AND (tags = "api")',
    }))
  })

  it('omits filter when no filters provided', async () => {
    await searchTemplates('test')

    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      filter: undefined,
    }))
  })

  it('uses highlight pre/post tags for <mark>', async () => {
    await searchTemplates('query')

    expect(mockSearch).toHaveBeenCalledWith('query', expect.objectContaining({
      highlightPreTag: '<mark>',
      highlightPostTag: '</mark>',
    }))
  })

  it('escapes double quotes in category filter values', async () => {
    await searchTemplates('test', { category: 'dev" OR slug = "x' })

    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      filter: 'category = "dev\\" OR slug = \\"x"',
    }))
  })

  it('escapes double quotes in tag filter values', async () => {
    await searchTemplates('test', { tags: ['tag"injection'] })

    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      filter: '(tags = "tag\\"injection")',
    }))
  })

  it('escapes backslashes in filter values', async () => {
    await searchTemplates('test', { category: 'path\\to\\thing' })

    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      filter: 'category = "path\\\\to\\\\thing"',
    }))
  })

  it('escapes backslash+quote combo in filter values', async () => {
    await searchTemplates('test', { tags: ['a\\"b'] })

    expect(mockSearch).toHaveBeenCalledWith('test', expect.objectContaining({
      filter: '(tags = "a\\\\\\"b")',
    }))
  })
})

describe('sanitizeHighlight', () => {
  it('preserves <mark> tags', () => {
    expect(sanitizeHighlight('Hello <mark>world</mark>')).toBe(
      'Hello <mark>world</mark>',
    )
  })

  it('strips script tags', () => {
    expect(sanitizeHighlight('<script>alert("xss")</script>Hello')).toBe(
      'alert("xss")Hello',
    )
  })

  it('strips img onerror', () => {
    expect(sanitizeHighlight('<img onerror="alert(1)">text')).toBe('text')
  })

  it('handles mixed mark + malicious tags', () => {
    expect(
      sanitizeHighlight('<mark>safe</mark><script>bad</script> ok'),
    ).toBe('<mark>safe</mark>bad ok')
  })

  it('passes through plain text unchanged', () => {
    expect(sanitizeHighlight('Hello world')).toBe('Hello world')
  })

  it('handles empty string', () => {
    expect(sanitizeHighlight('')).toBe('')
  })
})
