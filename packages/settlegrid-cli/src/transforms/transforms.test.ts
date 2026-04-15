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

describe('codemod hostile-review regression guards', () => {
  // Each `it` here guards one specific finding from the P2.3 hostile
  // review pass. Break any one of these and the relevant bug comes back.

  it('add-mcp: inserts init when only setRequestHandler is present (no visible new Server())', () => {
    // Repro for Finding 1 ("handlers wrapped without declaring sg")
    // A repo that imports `server` from another file and only
    // registers handlers here must still get `const sg = …` hoisted
    // above the first `sg.wrap(…)` reference.
    const before = `import { server } from './setup.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }))
`
    const after = addMcpTransform(before, {
      filename: 'handlers.ts',
      toolSlug: 'impl-only',
    })
    const initIdx = after.indexOf('const sg = settlegrid.init')
    const wrapIdx = after.indexOf('sg.wrap(')
    expect(initIdx).toBeGreaterThan(-1)
    expect(wrapIdx).toBeGreaterThan(-1)
    expect(initIdx).toBeLessThan(wrapIdx)
  })

  it('add-mcp: matches `new namespace.Server()` namespace-import callees', () => {
    // Repro for Finding 7 ("MCP namespace constructors not matched").
    const before = `import * as sdk from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

const server = new sdk.Server({ name: 'ns', version: '0.0.0' })
server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }))
`
    const after = addMcpTransform(before, {
      filename: 'ns.ts',
      toolSlug: 'ns-sample',
    })
    expect(after).toContain("from '@settlegrid/mcp'")
    expect(after).toContain('const sg = settlegrid.init')
    expect(after).toContain('sg.wrap(')
  })

  it('add-mcp: kebab-cases the method name for schemas referenced via MemberExpression', () => {
    // Repro for Finding 6 ("kebab skipped for MemberExpression schemas").
    const before = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import * as schemas from '@modelcontextprotocol/sdk/types.js'

const server = new Server({ name: 'mem', version: '0.0.0' })
server.setRequestHandler(schemas.ListToolsRequestSchema, async () => ({ tools: [] }))
`
    const after = addMcpTransform(before, {
      filename: 'mem.ts',
      toolSlug: 'mem-sample',
    })
    // Both "list-tools" kebab output and NOT the raw identifier.
    expect(after).toContain("method: 'list-tools'")
    expect(after).not.toContain("method: 'ListToolsRequestSchema'")
  })

  it('add-rest: does NOT wrap non-function handler args (looksLikeFunction guard)', () => {
    // Repro for Finding 3 ("non-function handlers wrapped").
    // `app.get('/health')` is a one-arg call with a STRING argument —
    // must not be treated as a handler. Same for object-literal args.
    const before = `import express from 'express'
const app = express()
app.get('/single-arg')
app.post('/with-opts', { ignored: true })
app.listen(3000)
`
    const after = addRestTransform(before, {
      filename: 'edge.ts',
      toolSlug: 'edge',
    })
    // No sg.wrap anywhere — neither call had a real handler.
    expect(after).not.toContain('sg.wrap(')
    // And the codemod should NOT have added an init either, since we
    // never actually wrapped anything.
    expect(after).not.toContain('settlegrid.init')
  })

  it('add-rest: does NOT wrap unrelated `.get(idx)` calls on non-app receivers (no .route() ancestor)', () => {
    // Repro for Finding 4 ("chain walker falls through on non-chains").
    // An Immutable.List-style `list.get(idx)` call has a single arg
    // and callee.property='get', so naive chain logic would treat it
    // as a chain form and wrap `idx`. We must require a `.route()`
    // ancestor in the chain before wrapping.
    const before = `import { List } from 'immutable'
const list = List([1, 2, 3])
console.log(list.get(0))

// Actual real REST handler for contrast:
import express from 'express'
const app = express()
app.get('/things', async (_req, res) => res.json(list.get(0)))
app.listen(3000)
`
    const after = addRestTransform(before, {
      filename: 'mixed.ts',
      toolSlug: 'mixed',
    })
    // The real handler IS wrapped.
    expect(after).toContain("method: 'get:/things'")
    // The inner `list.get(0)` inside the wrapped handler body is
    // still there as a read (arguments[0] is the integer literal,
    // which isn't a function → it's untouched).
    expect(after).toContain('list.get(0)')
    // Count `sg.wrap(` occurrences — exactly ONE (the real route).
    const wrapCount = (after.match(/sg\.wrap\(/g) ?? []).length
    expect(wrapCount).toBe(1)
  })

  it('add-langchain: AST idempotency ignores comments mentioning "sg.wrap("', () => {
    // Repro for Finding 8 ("textual idempotency false-positive on comments").
    // A method body whose ONLY occurrence of "sg.wrap(" is inside a
    // comment must still be wrapped. Note: recast strips comments
    // from non-commented AST output for nested subtrees, so we place
    // a // line comment inside the body with the trigger text. If
    // our idempotency check is AST-based we wrap; if it's textual
    // we don't.
    const before = `import { StructuredTool } from '@langchain/core/tools'
class SearchTool extends StructuredTool {
  name = 'search'
  description = 'search'
  schema: never = {} as never
  async _call(input: { query: string }): Promise<string> {
    // TODO: consider sg.wrap( integration later
    return 'result'
  }
}
export { SearchTool }
`
    const after = addLangchainTransform(before, {
      filename: 'comment.ts',
      toolSlug: 'comment-tool',
    })
    // The comment must not block wrapping — body now contains the
    // real `sg.wrap(...)` call.
    expect(after).toContain("from '@settlegrid/mcp'")
    expect(after).toContain('settlegrid.init')
    expect(after).toContain('sg.wrap(')
    expect(after).toContain('method: this.name')
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
