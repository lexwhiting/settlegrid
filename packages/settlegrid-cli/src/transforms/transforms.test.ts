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
