import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

// Source pins: the crawled MCP directory stays unpublished (vitest runs in node, without a DOM).
const app = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(app, rel), 'utf8')

describe('crawled MCP directory (unpublished)', () => {
  it('/mcp redirects to the directory of SettleGrid servers and reads no data', () => {
    const page = read('mcp/page.tsx')
    expect(page).toContain("redirect('/servers')")
    expect(page).not.toMatch(/shadow-index|mcp-directory|@\/lib\/db/)
  })

  it('serves no per-repo pages under /mcp', () => {
    expect(existsSync(path.join(app, 'mcp/[owner]'))).toBe(false)
  })

  it('lists no crawled entries in the sitemap', () => {
    const sitemap = read('sitemap.ts')
    expect(sitemap).not.toContain('mcpShadowIndex')
    expect(sitemap).not.toMatch(/\/mcp\/\$\{/)
  })
})
