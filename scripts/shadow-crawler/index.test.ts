import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Fixtures ───────────────────────────────────────────────────────────────

const PULSEMCP_RESPONSE = [
  {
    name: 'Test Server',
    description: 'A test MCP server',
    github_url: 'https://github.com/testowner/test-server',
    categories: ['data'],
    tags: ['test'],
  },
  { name: 'No GitHub', description: 'Missing URL' },
]

const SMITHERY_RESPONSE = {
  servers: [
    {
      qualifiedName: 'author/cool-server',
      displayName: 'Cool Server',
      description: 'A cool server',
      tags: ['cool'],
    },
  ],
}

const AWESOME_MCP_README = `# Awesome MCP Servers

## Data Tools

- [Weather API](https://github.com/someone/weather-api) - Get weather data
- [Stock Data](https://github.com/trader/stock-data) - Real-time stock prices

## Utilities

- [NotALink](broken-link) - This should be skipped
`

const GITHUB_SEARCH_RESPONSE = {
  total_count: 1,
  items: [
    {
      full_name: 'org/mcp-tool',
      name: 'mcp-tool',
      owner: { login: 'org' },
      description: 'An MCP tool',
      stargazers_count: 42,
      updated_at: '2026-01-15T00:00:00Z',
      html_url: 'https://github.com/org/mcp-tool',
      topics: ['mcp', 'ai'],
    },
  ],
}

const NPM_SEARCH_RESPONSE = {
  objects: [
    {
      package: {
        name: '@modelcontextprotocol/test-pkg',
        description: 'Test npm package',
        keywords: ['mcp'],
        links: {
          repository: 'https://github.com/npmuser/test-pkg',
          npm: 'https://www.npmjs.com/package/@modelcontextprotocol/test-pkg',
        },
        date: '2026-03-01T00:00:00Z',
      },
    },
  ],
  total: 1,
}

// ── Mock fetch-utils at module level ───────────────────────────────────────

let mockJsonResponses: unknown[] = []
let mockTextResponses: string[] = []

vi.mock('./fetch-utils', () => ({
  fetchJson: vi.fn(async () => mockJsonResponses.shift() ?? {}),
  fetchWithRetry: vi.fn(async () => ({
    ok: true,
    text: async () => mockTextResponses.shift() ?? '',
    json: async () => mockJsonResponses.shift() ?? {},
  })),
}))

// ── Tests ──────────────────────────────────────────────────────────────────

describe('shadow-crawler sources', () => {
  beforeEach(() => {
    mockJsonResponses = []
    mockTextResponses = []
    vi.clearAllMocks()
  })

  it('pulsemcp: parses servers with GitHub URLs, skips entries without', async () => {
    mockJsonResponses = [PULSEMCP_RESPONSE]

    const { fetchPulseMCP } = await import('./sources/pulsemcp')
    const records = []
    for await (const r of fetchPulseMCP()) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      source: 'pulsemcp',
      owner: 'testowner',
      repo: 'test-server',
      name: 'Test Server',
    })
  })

  it('smithery: parses qualifiedName into owner/repo', async () => {
    mockJsonResponses = [SMITHERY_RESPONSE]

    const { fetchSmithery } = await import('./sources/smithery')
    const records = []
    for await (const r of fetchSmithery()) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      source: 'smithery',
      owner: 'author',
      repo: 'cool-server',
      name: 'Cool Server',
    })
  })

  it('awesome-mcp: parses markdown entries with GitHub links', async () => {
    mockTextResponses = [AWESOME_MCP_README]

    const { fetchAwesomeMCP } = await import('./sources/awesome-mcp')
    const records = []
    for await (const r of fetchAwesomeMCP()) records.push(r)

    expect(records).toHaveLength(2)
    expect(records[0]).toMatchObject({
      source: 'awesome-mcp',
      owner: 'someone',
      repo: 'weather-api',
      name: 'Weather API',
      category: 'Data Tools',
    })
    expect(records[1]).toMatchObject({
      owner: 'trader',
      repo: 'stock-data',
    })
  })

  it('github: extracts repo data from search API response', async () => {
    mockJsonResponses = [GITHUB_SEARCH_RESPONSE]

    const { fetchGitHub } = await import('./sources/github')
    const records = []
    for await (const r of fetchGitHub({ limit: 5 })) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      source: 'github',
      owner: 'org',
      repo: 'mcp-tool',
      stars: 42,
    })
  })

  it('npm: extracts package data and parses repo URL', async () => {
    mockJsonResponses = [
      NPM_SEARCH_RESPONSE,
      { objects: [], total: 0 },
      { objects: [], total: 0 },
    ]

    const { fetchNpm } = await import('./sources/npm')
    const records = []
    for await (const r of fetchNpm({ limit: 5 })) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      source: 'npm',
      owner: 'npmuser',
      repo: 'test-pkg',
      name: '@modelcontextprotocol/test-pkg',
    })
  })

  it('pypi: fetches simple index and resolves package details', async () => {
    const PYPI_INDEX = '<a href="/simple/mcp-server-test/">mcp-server-test</a>'
    const PYPI_PKG = {
      info: {
        name: 'mcp-server-test',
        summary: 'A test MCP server for Python',
        home_page: 'https://github.com/pyuser/mcp-server-test',
        author: 'pyuser',
      },
    }
    // Three search terms: first returns index + detail, rest return empty
    mockTextResponses = [PYPI_INDEX, '', '']
    mockJsonResponses = [PYPI_PKG]

    const { fetchPyPI } = await import('./sources/pypi')
    const records = []
    for await (const r of fetchPyPI({ limit: 5 })) records.push(r)

    expect(records).toHaveLength(1)
    expect(records[0]).toMatchObject({
      source: 'pypi',
      owner: 'pyuser',
      repo: 'mcp-server-test',
    })
  })
})

describe('shadow-crawler main', () => {
  beforeEach(() => {
    mockJsonResponses = []
    mockTextResponses = []
    vi.clearAllMocks()
  })

  it('--dry-run collects records but does not upsert (total = 0)', async () => {
    mockJsonResponses = [PULSEMCP_RESPONSE]

    const { crawl } = await import('./index')
    const result = await crawl({
      source: 'pulsemcp',
      dryRun: true,
    })

    expect(result.perSource.pulsemcp).toBe(1)
    expect(result.total).toBe(0)
  })

  it('respects --limit across source iteration', async () => {
    mockJsonResponses = [PULSEMCP_RESPONSE]

    const { crawl } = await import('./index')
    const result = await crawl({
      source: 'pulsemcp',
      limit: 1,
      dryRun: true,
    })

    expect(result.perSource.pulsemcp).toBe(1)
  })
})
