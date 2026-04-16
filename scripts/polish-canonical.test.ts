import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { writeFile, mkdir, readFile, rm, mkdtemp } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  polishCanonical,
  generateTemplateJson,
  generateReadme,
  generateMonetizationMd,
  generateRemoveSettlegridMd,
} from './polish-canonical'

// ── Fixtures ───────────────────────────────────────────────────────────────

const FAKE_ENTRY = {
  slug: 'fake-api',
  name: 'Fake API',
  score: 94,
  sourceCategory: 'developer',
  manifestCategory: 'devtools',
  selectionRationale: 'Test fixture',
}

const FAKE_PKG = {
  name: 'settlegrid-fake-api',
  version: '1.0.0',
  description: 'Search fake resources on Fake Platform.',
  keywords: ['settlegrid', 'mcp', 'ai', 'fake', 'testing', 'developer'],
  repository: { type: 'git', url: 'https://github.com/settlegrid/settlegrid-fake-api' },
}

const FAKE_README = `# settlegrid-fake-api

Fake MCP Server with per-call billing.

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| \`search_items(query)\` | Search fake items | 1\u00A2 |
| \`get_item(id)\` | Get a specific item | 1\u00A2 |

## Parameters

### search_items
- \`query\` (string, required)

## Upstream API

- **Provider**: Fake Platform
- **Base URL**: https://api.fake.dev
- **Auth**: API key required
- **Docs**: https://docs.fake.dev
`

const FAKE_CTX = {
  entry: FAKE_ENTRY,
  description: 'Search fake resources on Fake Platform.',
  keywords: ['settlegrid', 'mcp', 'ai', 'fake', 'testing', 'developer'],
  repoUrl: 'https://github.com/settlegrid/settlegrid-fake-api',
  methodsTable:
    '| Method | Description | Cost |\n|--------|-------------|------|\n| `search_items(query)` | Search fake items | 1\u00A2 |\n| `get_item(id)` | Get a specific item | 1\u00A2 |',
  capabilities: ['search-items', 'get-item'],
  upstreamInfo: '- **Provider**: Fake Platform\n- **Base URL**: https://api.fake.dev\n- **Auth**: API key required\n- **Docs**: https://docs.fake.dev',
}

// ── Test setup ─────────────────────────────────────────────────────────────

let tmpRoot: string
let tmpServers: string
let tmpCanonical: string

beforeEach(async () => {
  tmpRoot = await mkdtemp(join(tmpdir(), 'sg-polish-test-'))
  tmpServers = join(tmpRoot, 'open-source-servers')

  // Create fake template directory with package.json and README
  const fakeDir = join(tmpServers, 'settlegrid-fake-api')
  await mkdir(fakeDir, { recursive: true })
  await writeFile(join(fakeDir, 'package.json'), JSON.stringify(FAKE_PKG))
  await writeFile(join(fakeDir, 'README.md'), FAKE_README)

  // Create CANONICAL_20.json for tests
  tmpCanonical = join(tmpRoot, 'CANONICAL_20.json')
  await writeFile(
    tmpCanonical,
    JSON.stringify({
      version: 1,
      entries: [FAKE_ENTRY],
    }),
  )
})

afterEach(async () => {
  await rm(tmpRoot, { recursive: true, force: true })
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('polish-canonical', () => {
  describe('generateTemplateJson', () => {
    it('produces a valid manifest for a fake slug', () => {
      const manifest = generateTemplateJson(FAKE_CTX)

      expect(manifest).toMatchObject({
        slug: 'fake-api',
        name: 'Fake API',
        version: '1.0.0',
        category: 'devtools',
        runtime: 'node',
        languages: ['ts'],
        entry: 'src/server.ts',
        pricing: { model: 'per-call', perCallUsdCents: 1 },
        quality: { tests: false },
        featured: false,
      })

      // Tags exclude generic keywords
      const tags = (manifest as Record<string, unknown>).tags as string[]
      expect(tags).not.toContain('settlegrid')
      expect(tags).not.toContain('mcp')
      expect(tags).not.toContain('ai')
      expect(tags).toContain('fake')
    })
  })

  describe('generateReadme', () => {
    it('contains all required sections', () => {
      const readme = generateReadme(FAKE_CTX)

      expect(readme).toContain('# Fake API')
      expect(readme).toContain('30-Second Quickstart')
      expect(readme).toContain('npx create-settlegrid-tool --template fake-api')
      expect(readme).toContain('## Monetization')
      expect(readme).toContain('monetization.md')
      expect(readme).toContain('Deploy with Vercel')
      expect(readme).toContain('Loom demo placeholder')
      expect(readme).toContain('remove-settlegrid.md')
      expect(readme).toContain('## Original README')
      expect(readme).toContain('### Upstream API')
      expect(readme).toContain('Fake Platform')
      expect(readme).toContain('## License')
    })
  })

  describe('generateMonetizationMd', () => {
    it('contains pricing math', () => {
      const md = generateMonetizationMd(FAKE_CTX)

      expect(md).toContain('Monetization Guide')
      expect(md).toContain('$0.01')
      expect(md).toContain('20%')
      expect(md).toContain('$0.008')
      expect(md).toContain('10,000')
    })
  })

  describe('generateRemoveSettlegridMd', () => {
    it('contains removal steps', () => {
      const md = generateRemoveSettlegridMd(FAKE_CTX)

      expect(md).toContain('npm uninstall @settlegrid/mcp')
      expect(md).toContain('sg.wrap')
      expect(md).toContain('SETTLEGRID_API_KEY')
      expect(md).toContain('no lock-in')
    })
  })

  describe('polishCanonical integration', () => {
    it('generates all 4 files per template', async () => {
      const result = await polishCanonical({
        canonical20Path: tmpCanonical,
        serversDir: tmpServers,
      })

      expect(result.polished).toEqual(['fake-api'])
      expect(result.skipped).toHaveLength(0)
      expect(result.validationErrors).toHaveLength(0)

      const dir = join(tmpServers, 'settlegrid-fake-api')

      // template.json exists and is valid JSON
      const tj = JSON.parse(await readFile(join(dir, 'template.json'), 'utf-8'))
      expect(tj.slug).toBe('fake-api')
      expect(tj.category).toBe('devtools')

      // README.md was rewritten
      const readme = await readFile(join(dir, 'README.md'), 'utf-8')
      expect(readme).toContain('30-Second Quickstart')

      // monetization.md exists
      const mon = await readFile(join(dir, 'monetization.md'), 'utf-8')
      expect(mon).toContain('Revenue Model')

      // remove-settlegrid.md exists
      const rem = await readFile(join(dir, 'remove-settlegrid.md'), 'utf-8')
      expect(rem).toContain('npm uninstall')
    })

    it('is idempotent — running twice produces no diff', async () => {
      await polishCanonical({
        canonical20Path: tmpCanonical,
        serversDir: tmpServers,
      })

      const dir = join(tmpServers, 'settlegrid-fake-api')
      const run1 = {
        tj: await readFile(join(dir, 'template.json'), 'utf-8'),
        readme: await readFile(join(dir, 'README.md'), 'utf-8'),
        mon: await readFile(join(dir, 'monetization.md'), 'utf-8'),
        rem: await readFile(join(dir, 'remove-settlegrid.md'), 'utf-8'),
      }

      await polishCanonical({
        canonical20Path: tmpCanonical,
        serversDir: tmpServers,
      })

      const run2 = {
        tj: await readFile(join(dir, 'template.json'), 'utf-8'),
        readme: await readFile(join(dir, 'README.md'), 'utf-8'),
        mon: await readFile(join(dir, 'monetization.md'), 'utf-8'),
        rem: await readFile(join(dir, 'remove-settlegrid.md'), 'utf-8'),
      }

      expect(run1).toEqual(run2)
    })

    it('skips templates with missing package.json', async () => {
      // Add an entry that doesn't exist on disk
      await writeFile(
        tmpCanonical,
        JSON.stringify({
          version: 1,
          entries: [
            FAKE_ENTRY,
            { ...FAKE_ENTRY, slug: 'missing-api', name: 'Missing' },
          ],
        }),
      )

      const result = await polishCanonical({
        canonical20Path: tmpCanonical,
        serversDir: tmpServers,
      })

      expect(result.polished).toEqual(['fake-api'])
      expect(result.skipped).toHaveLength(1)
      expect(result.skipped[0].slug).toBe('missing-api')
    })
  })
})
