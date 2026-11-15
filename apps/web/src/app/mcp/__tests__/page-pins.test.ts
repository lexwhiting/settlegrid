import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

// Source pins for the /mcp directory page (vitest runs in node, without a DOM).
const page = readFileSync(path.resolve(__dirname, '../page.tsx'), 'utf8')

describe('/mcp directory page (source pins)', () => {
  it('renders per request, so the build never runs its database reads', () => {
    expect(page).toMatch(/^export const dynamic = 'force-dynamic'$/m)
    expect(page).not.toMatch(/^export const dynamic = 'force-static'$/m)
  })

  it('reads its data through the bounded loader', () => {
    expect(page).toContain('await loadMcpDirectory()')
    expect(page).not.toMatch(/from '@\/lib\/shadow-index'/)
  })
})
