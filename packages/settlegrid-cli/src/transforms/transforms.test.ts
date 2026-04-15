import { describe, it, expect } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { addMcpTransform } from './add-mcp.js'
import { addLangchainTransform } from './add-langchain.js'
import { addRestTransform } from './add-rest.js'
import type { Codemod } from './runner.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtures = path.join(here, '__testfixtures__')

interface FixtureCase {
  name: string
  codemod: Codemod
  toolSlug: string
}

const FIXTURE_CASES: FixtureCase[] = [
  { name: 'mcp-basic', codemod: addMcpTransform, toolSlug: 'mcp-basic' },
  { name: 'mcp-multi-handler', codemod: addMcpTransform, toolSlug: 'mcp-multi-handler' },
  { name: 'mcp-already-wrapped', codemod: addMcpTransform, toolSlug: 'mcp-already' },
  { name: 'langchain-tool', codemod: addLangchainTransform, toolSlug: 'langchain-tool' },
  { name: 'rest-express', codemod: addRestTransform, toolSlug: 'rest-express' },
  { name: 'rest-hono', codemod: addRestTransform, toolSlug: 'rest-hono' },
  // Spec step 3 calls out "app.route(...).get" as a case the REST
  // codemod must handle. This fixture exercises the chain form
  // (`.route(path).get(handler)`) where the verb call has a single
  // handler argument and the path lives on the enclosing .route() call.
  { name: 'rest-route-chain', codemod: addRestTransform, toolSlug: 'rest-route-chain' },
]

async function readFixture(name: string, suffix: 'before' | 'after'): Promise<string> {
  return fsp.readFile(path.join(fixtures, `${name}.${suffix}.ts`), 'utf-8')
}

describe('codemod fixtures — each before file transforms to the recorded after file', () => {
  for (const c of FIXTURE_CASES) {
    it(`${c.name}: before → after matches the recorded fixture`, async () => {
      const before = await readFixture(c.name, 'before')
      const expected = await readFixture(c.name, 'after')
      const actual = c.codemod(before, {
        filename: `${c.name}.before.ts`,
        toolSlug: c.toolSlug,
      })
      expect(actual).toBe(expected)
    })
  }
})

describe('codemod idempotency — running twice produces the same output as running once', () => {
  for (const c of FIXTURE_CASES) {
    it(`${c.name}: codemod(codemod(before)) === codemod(before)`, async () => {
      const before = await readFixture(c.name, 'before')
      const once = c.codemod(before, {
        filename: `${c.name}.before.ts`,
        toolSlug: c.toolSlug,
      })
      const twice = c.codemod(once, {
        filename: `${c.name}.before.ts`,
        toolSlug: c.toolSlug,
      })
      expect(twice).toBe(once)
    })
  }

  it('mcp-already-wrapped: codemod is a no-op (before === after)', async () => {
    const before = await readFixture('mcp-already-wrapped', 'before')
    const after = addMcpTransform(before, {
      filename: 'mcp-already-wrapped.before.ts',
      toolSlug: 'mcp-already',
    })
    expect(after).toBe(before)
  })
})

describe('addRestTransform — spec-literal edge cases', () => {
  // Semantic regression guards beyond the fixture comparisons, to lock
  // in two placement invariants that are easy to regress during AST
  // surgery but observably break at runtime.

  it('inserts `const sg = settlegrid.init(...)` BEFORE the first route, never after', async () => {
    // With inline `sg.wrap(...)` in each route call, init MUST be
    // declared before the first route — otherwise TDZ kicks in and
    // module load throws ReferenceError. Verified by index-of on the
    // transform output: the init declaration's character offset must
    // come before every wrapped route registration.
    const before = await readFixture('rest-route-chain', 'before')
    const after = addRestTransform(before, {
      filename: 'rest-route-chain.before.ts',
      toolSlug: 'rest-route-chain',
    })
    const initIdx = after.indexOf('const sg = settlegrid.init')
    const firstWrapIdx = after.indexOf('sg.wrap(')
    expect(initIdx).toBeGreaterThan(-1)
    expect(firstWrapIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeLessThan(firstWrapIdx)
  })

  it('wraps every verb in `app.route(path).get(h).post(h)` chains with the route path as the method key', async () => {
    const before = await readFixture('rest-route-chain', 'before')
    const after = addRestTransform(before, {
      filename: 'rest-route-chain.before.ts',
      toolSlug: 'rest-route-chain',
    })
    // Three chained verbs in the fixture — expect the method key for
    // each to echo the enclosing `.route(...)` path, not '/'.
    expect(after).toContain("method: 'get:/users'")
    expect(after).toContain("method: 'post:/users'")
    expect(after).toContain("method: 'get:/items'")
  })
})
