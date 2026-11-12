import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

// The revenue-share claim is "95–100%" (AGENTS.md, Honest claims, rule 8): the
// progressive take is 0% on the first $1,000 of a month and never above 5%.
// These surfaces used to say "up to 100%", which names only the best case.
const WEB = path.resolve(__dirname, '../..')
const read = (rel: string) => readFileSync(path.join(WEB, rel), 'utf8')

const SURFACES = [
  'public/llms.txt',
  'public/llms-full.txt',
  'src/app/(auth)/register/page.tsx',
  'src/app/api/chat/route.ts',
  'src/app/docs/page.tsx',
  'src/app/learn/blog/[slug]/page.tsx',
  'src/app/learn/glossary/page.tsx',
  'src/app/learn/how-mcp-billing-works/page.tsx',
  'src/app/learn/mcp-zero-problem/page.tsx',
  'src/app/learn/state-of-mcp-2026/page.tsx',
  'src/lib/blog-posts.ts',
]

/** Every source and public text file of the web app, tests excluded. */
function publicTextFiles(dir: string): string[] {
  return readdirSync(path.join(WEB, dir), { withFileTypes: true }).flatMap((entry) => {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : publicTextFiles(rel)
    return /\.(ts|tsx|md|mdx|txt|json)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [rel] : []
  })
}

describe('revenue-share wording', () => {
  it.each(SURFACES)('%s does not say "up to 100%%"', (rel) => {
    expect(read(rel)).not.toMatch(/up to 100\s?%/i)
  })

  it('no source or public file of the web app says "up to 100%"', () => {
    const files = [...publicTextFiles('src'), ...publicTextFiles('public')]
    expect(files.length).toBeGreaterThan(500)
    expect(files.filter((rel) => /up to 100\s?%/i.test(read(rel)))).toEqual([])
  })

  it('the surfaces that state the share use the 95–100% range', () => {
    for (const rel of SURFACES.filter((s) => s !== 'src/app/learn/glossary/page.tsx')) {
      expect(read(rel), rel).toContain('95–100%')
    }
    // The glossary gives the per-bracket figures instead.
    expect(read('src/app/learn/glossary/page.tsx')).toContain('keep 100% of their revenue on the first $1,000/month and 95-98% above that')
  })

  it('llms.txt does not rank the share against the category', () => {
    expect(read('public/llms.txt')).not.toMatch(/highest in category/i)
  })

  it('the blog plan table counts brokered protocols, not a retired total', () => {
    const posts = read('src/lib/blog-posts.ts')
    expect(posts).not.toContain("'All 10'")
    expect(posts).toContain("['Payment protocols', '9 brokered', '9 brokered', '9 brokered']")
  })
})
