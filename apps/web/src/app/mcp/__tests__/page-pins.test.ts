import { describe, it, expect, vi } from 'vitest'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const { mockRedirect } = vi.hoisted(() => ({
  mockRedirect: vi.fn((url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`)
  }),
}))
vi.mock('next/navigation', () => ({ redirect: mockRedirect }))

// The crawled MCP directory stays unpublished, and neither /mcp nor any other
// page may claim a directory of "every" or "thousands of" MCP servers.
// (vitest runs in node, without a DOM.)
const app = path.resolve(__dirname, '../..')
const web = path.resolve(app, '../..')
const read = (rel: string) => readFileSync(path.join(app, rel), 'utf8')

/** Every source and public text file of the web app, tests excluded. */
function textFiles(dir: string): string[] {
  return readdirSync(path.join(web, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : textFiles(rel)
    return /\.(ts|tsx|md|mdx|txt|json)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : []
  })
}

describe('crawled MCP directory (unpublished)', () => {
  it('/mcp redirects to the directory of SettleGrid servers when rendered', async () => {
    const mod = await import('../page')
    expect(() => mod.default()).toThrow('NEXT_REDIRECT:/servers')
    expect(mockRedirect).toHaveBeenCalledTimes(1)
    expect(mockRedirect).toHaveBeenCalledWith('/servers')
  })

  it('/mcp reads no data and exposes no directory metadata', async () => {
    const page = read('mcp/page.tsx')
    expect(page).toContain("redirect('/servers')")
    expect(page).toMatch(/^export const dynamic = 'force-dynamic'$/m) // rendered per request, never during the build
    expect(page).not.toMatch(/^export const dynamic = 'force-static'$/m)
    expect(page).not.toMatch(/shadow-index|mcp-directory|@\/lib\/db/)
    expect(page).not.toMatch(/export (const metadata|(async )?function generateMetadata)/)
    const mod: Record<string, unknown> = await import('../page')
    expect(Object.keys(mod).sort()).toEqual(['default', 'dynamic'])
  })

  it('/mcp makes no directory claims and shows no internal wording', () => {
    const page = read('mcp/page.tsx')
    expect(page).not.toMatch(/every MCP server|all MCP servers|thousands of MCP servers/i)
    expect(page).not.toMatch(/run the crawler|shadow directory|seed data/i)
  })

  it('serves no per-repo pages under /mcp', () => {
    expect(existsSync(path.join(app, 'mcp/[owner]'))).toBe(false)
  })

  it('lists no crawled entries in the sitemap', () => {
    const sitemap = read('sitemap.ts')
    expect(sitemap).not.toContain('mcpShadowIndex')
    expect(sitemap).not.toMatch(/\/mcp\/\$\{/)
  })

  it('no source or public file of the web app claims every or thousands of MCP servers', () => {
    const files = [...textFiles('src'), ...textFiles('public')]
    expect(files.length).toBeGreaterThan(500)
    expect(files.filter((rel) => /every MCP server on the web|thousands of MCP servers/i.test(readFileSync(path.join(web, rel), 'utf8')))).toEqual([])
  })
})
