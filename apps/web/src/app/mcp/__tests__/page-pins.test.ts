import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source pins for the /mcp directory pages (vitest runs in node, without a DOM).
const page = readFileSync(path.resolve(__dirname, '../page.tsx'), 'utf8')
const detail = readFileSync(path.resolve(__dirname, '../[owner]/[repo]/page.tsx'), 'utf8')

describe('/mcp directory page (source pins)', () => {
  it('renders per request, so the build never runs its database reads', () => {
    expect(page).toMatch(/^export const dynamic = 'force-dynamic'$/m)
    expect(page).not.toMatch(/^export const dynamic = 'force-static'$/m)
  })

  it('reads its data once per request, through the bounded loader, for the page and its metadata', () => {
    expect(page).toContain('await getMcpDirectory()')
    expect(page).toContain('return mcpDirectoryMetadata(totalCount)')
    expect(page).not.toMatch(/^export const metadata/m)
    expect(page).not.toMatch(/from '@\/lib\/shadow-index'/)
  })

  it('shows public wording only: no internal instructions and no claim to list every server', () => {
    for (const source of [page, detail]) {
      expect(source).not.toMatch(/run the crawler|shadow directory|seed data/i)
      expect(source).toContain('No servers are listed here yet.')
    }
    expect(page).not.toMatch(/every MCP server on the web/i)
    expect(page).not.toMatch(/thousands of MCP servers/i)
  })

  it('keeps the detail page for a missing entry out of search indexes', () => {
    expect(detail).toContain("return { title: 'MCP Server Not Found | SettleGrid', robots: { index: false, follow: false } }")
  })
})
