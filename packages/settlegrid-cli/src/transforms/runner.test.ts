import { describe, it, expect } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  addPackageDependency,
  isAlreadyWrapped,
  runTransform,
  SETTLEGRID_MCP_RANGE,
  type TransformInput,
} from './runner.js'
import type { DetectResult } from '../detect/index.js'

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'settlegrid-transform-'))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

function detect(type: DetectResult['type']): DetectResult {
  return {
    type,
    confidence: type === 'unknown' ? 0 : 0.8,
    language: 'ts',
    entryPoints: [],
    reasons: ['test-fixture'],
  }
}

describe('isAlreadyWrapped', () => {
  it('recognises the @settlegrid/mcp import as already-wrapped', () => {
    expect(isAlreadyWrapped("import { settlegrid } from '@settlegrid/mcp'\n")).toBe(true)
  })
  it('recognises a settlegrid.init(...) call as already-wrapped', () => {
    expect(isAlreadyWrapped('const sg = settlegrid.init({ toolSlug: "x" })')).toBe(true)
  })
  it('recognises subpath imports (`@settlegrid/mcp/kernel`, `/rest`) as already-wrapped', () => {
    // Hostile-review finding: prior regex only matched the bare
    // main entry, so files importing a subpath slipped through and
    // got a duplicate top-level import added on top of them.
    expect(isAlreadyWrapped("import { kernel } from '@settlegrid/mcp/kernel'\n")).toBe(true)
    expect(isAlreadyWrapped('import { middleware } from "@settlegrid/mcp/rest"\n')).toBe(true)
  })
  it('returns false for unrelated source', () => {
    expect(isAlreadyWrapped('export const noop = () => undefined\n')).toBe(false)
  })
  it('returns false for look-alike imports that do NOT target @settlegrid/mcp', () => {
    // Regression guard for over-broad matching: a package named
    // something-mcp must not be confused with @settlegrid/mcp.
    expect(isAlreadyWrapped("import { x } from 'some-other-mcp'\n")).toBe(false)
    expect(isAlreadyWrapped("import { x } from '@some/other-mcp'\n")).toBe(false)
  })
})

describe('addPackageDependency — package.json mutation', () => {
  it('inserts the dep with keys alphabetically sorted (deterministic)', async () => {
    await withTmp(async (dir) => {
      const pkgPath = path.join(dir, 'package.json')
      await fsp.writeFile(
        pkgPath,
        JSON.stringify(
          {
            name: 'tgt',
            dependencies: { zod: '^3.22.0', express: '^4.19.0', lodash: '^4.17.0' },
          },
          null,
          2,
        ) + '\n',
      )

      const changed = await addPackageDependency(dir, '@settlegrid/mcp', SETTLEGRID_MCP_RANGE)
      expect(changed).toBe(true)

      const written = JSON.parse(await fsp.readFile(pkgPath, 'utf-8')) as {
        dependencies: Record<string, string>
      }
      // Keys must be alphabetically sorted across every run.
      expect(Object.keys(written.dependencies)).toEqual([
        '@settlegrid/mcp',
        'express',
        'lodash',
        'zod',
      ])
      expect(written.dependencies['@settlegrid/mcp']).toBe(SETTLEGRID_MCP_RANGE)
    })
  })

  it('is a no-op when the dep is already declared', async () => {
    await withTmp(async (dir) => {
      const pkgPath = path.join(dir, 'package.json')
      await fsp.writeFile(
        pkgPath,
        JSON.stringify({
          name: 'tgt',
          dependencies: { '@settlegrid/mcp': '^0.1.0' },
        }) + '\n',
      )
      const before = await fsp.readFile(pkgPath, 'utf-8')
      const changed = await addPackageDependency(dir, '@settlegrid/mcp', SETTLEGRID_MCP_RANGE)
      expect(changed).toBe(false)
      const after = await fsp.readFile(pkgPath, 'utf-8')
      expect(after).toBe(before)
    })
  })

  it('preserves 4-space indentation when the target uses it', async () => {
    await withTmp(async (dir) => {
      const pkgPath = path.join(dir, 'package.json')
      // 4-space indented package.json
      const input = `{
    "name": "tgt",
    "dependencies": {
        "express": "^4.19.0"
    }
}
`
      await fsp.writeFile(pkgPath, input)
      await addPackageDependency(dir, '@settlegrid/mcp', SETTLEGRID_MCP_RANGE)
      const written = await fsp.readFile(pkgPath, 'utf-8')
      // 4-space indent preserved on the dependency lines.
      expect(written).toMatch(/^ {4}"dependencies":/m)
      expect(written).toMatch(/^ {8}"@settlegrid\/mcp":/m)
    })
  })

  it('does nothing when package.json is missing or malformed', async () => {
    await withTmp(async (dir) => {
      // No package.json
      await expect(
        addPackageDependency(dir, '@settlegrid/mcp', SETTLEGRID_MCP_RANGE),
      ).resolves.toBe(false)

      // Malformed package.json
      const pkgPath = path.join(dir, 'package.json')
      await fsp.writeFile(pkgPath, '{ not json')
      await expect(
        addPackageDependency(dir, '@settlegrid/mcp', SETTLEGRID_MCP_RANGE),
      ).resolves.toBe(false)
    })
  })
})

describe('runTransform — dispatch + dry-run contract', () => {
  it('dispatches mcp-server type to the MCP codemod + returns the expected diff', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
export { server }
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'tgt', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)

      const input: TransformInput = {
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      }
      const result = await runTransform(input)
      expect(result.changedFiles.length).toBeGreaterThan(0)
      expect(result.envVarsRequired).toContain('SETTLEGRID_API_KEY')
      expect(result.addedDependencies).toEqual({
        '@settlegrid/mcp': SETTLEGRID_MCP_RANGE,
      })
      expect(result.changedFiles[0].after).toContain("from '@settlegrid/mcp'")
      expect(result.changedFiles[0].after).toContain('sg.wrap')
    })
  })

  it('returns no changes + no codemod for detect.type === "unknown"', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(path.join(dir, 'app.js'), 'module.exports = {}\n')
      const result = await runTransform({
        rootDir: dir,
        detect: detect('unknown'),
        dryRun: true,
      })
      expect(result.changedFiles).toEqual([])
      expect(result.skipped).toEqual([])
      // No dependency advertised when we don't know how to transform.
      expect(result.addedDependencies).toEqual({})
    })
  })

  it('skips files that already import @settlegrid/mcp with reason "already-wrapped"', async () => {
    await withTmp(async (dir) => {
      const alreadyWrapped = `import { settlegrid } from '@settlegrid/mcp'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const sg = settlegrid.init({ toolSlug: 'x', pricing: { defaultCostCents: 1 } })
const server = new Server({ name: 'x', version: '0.0.0' })
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'tgt', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), alreadyWrapped)

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      })
      expect(result.changedFiles).toEqual([])
      expect(result.skipped).toContainEqual({
        path: 'server.ts',
        reason: 'already-wrapped',
      })
    })
  })

  it('does NOT write to disk when dryRun is true (mtime unchanged)', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      const pkgRaw = JSON.stringify({ name: 'tgt', dependencies: {} }) + '\n'
      const serverPath = path.join(dir, 'server.ts')
      const pkgPath = path.join(dir, 'package.json')
      await fsp.writeFile(pkgPath, pkgRaw)
      await fsp.writeFile(serverPath, src)

      const beforeServerMtime = (await fsp.stat(serverPath)).mtimeMs
      const beforePkgMtime = (await fsp.stat(pkgPath)).mtimeMs
      // Wait a tiny amount to ensure any write would produce a different mtime.
      await new Promise((r) => setTimeout(r, 20))

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      })
      expect(result.changedFiles.length).toBeGreaterThan(0)

      const afterServerMtime = (await fsp.stat(serverPath)).mtimeMs
      const afterPkgMtime = (await fsp.stat(pkgPath)).mtimeMs
      expect(afterServerMtime).toBe(beforeServerMtime)
      expect(afterPkgMtime).toBe(beforePkgMtime)
      expect(await fsp.readFile(serverPath, 'utf-8')).toBe(src)
      expect(await fsp.readFile(pkgPath, 'utf-8')).toBe(pkgRaw)
    })
  })

  // Hostile-review finding: the prior write loop aborted on the first
  // failing writeFile and skipped both (a) remaining files and (b) the
  // package.json update, leaving the target repo in an inconsistent
  // partially-wrapped state. The fix moves failures into `skipped`
  // with reason "write failed: …" and keeps going.
  it('continues writing + updates package.json when one file write fails', async () => {
    // Skip on Windows where chmod semantics differ and make read-only
    // unreliable in a test harness.
    if (process.platform === 'win32') return

    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'tgt', dependencies: {} }, null, 2) + '\n',
      )

      const writable = path.join(dir, 'writable.ts')
      const readonly = path.join(dir, 'readonly.ts')
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      await fsp.writeFile(writable, src)
      await fsp.writeFile(readonly, src)
      // Make the second file read-only so writeFile will throw.
      await fsp.chmod(readonly, 0o444)

      try {
        const result = await runTransform({
          rootDir: dir,
          detect: detect('mcp-server'),
          dryRun: false,
        })

        // The writable file should have landed on disk AND be present
        // in changedFiles.
        const writtenWritable = await fsp.readFile(writable, 'utf-8')
        expect(writtenWritable).toContain("from '@settlegrid/mcp'")
        expect(result.changedFiles.some((c) => c.path === 'writable.ts')).toBe(true)

        // The read-only file must NOT have been modified …
        const rawReadonly = await fsp.readFile(readonly, 'utf-8')
        expect(rawReadonly).toBe(src)
        // … and must show up in skipped with a "write failed" reason.
        expect(result.skipped.some(
          (s) => s.path === 'readonly.ts' && s.reason.startsWith('write failed'),
        )).toBe(true)

        // package.json update runs despite the per-file failure —
        // this is the critical invariant: one bad file can't leave
        // the target without the @settlegrid/mcp dep.
        const writtenPkg = JSON.parse(
          await fsp.readFile(path.join(dir, 'package.json'), 'utf-8'),
        ) as { dependencies: Record<string, string> }
        expect(writtenPkg.dependencies['@settlegrid/mcp']).toBe(SETTLEGRID_MCP_RANGE)
      } finally {
        // Restore write permission so withTmp cleanup works.
        await fsp.chmod(readonly, 0o644).catch(() => {})
      }
    })
  })

  it('derives toolSlug from scoped package names (`@acme/foo` → `foo`)', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: '@acme/coolname', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      })
      expect(result.changedFiles[0].after).toContain("toolSlug: 'coolname'")
      // Scope prefix is stripped, not preserved.
      expect(result.changedFiles[0].after).not.toContain("@acme")
    })
  })

  it('falls back to toolSlug: "my-tool" when package.json has no name', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      // Package.json with a "version" but no "name" field.
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ version: '0.0.0', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      })
      expect(result.changedFiles[0].after).toContain("toolSlug: 'my-tool'")
    })
  })

  it('sanitises package name special characters into a kebab slug', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      // Weird-but-valid package name: uppercase, underscores, dots.
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'My_Weird.Name!!', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: true,
      })
      // Everything that isn't [a-z0-9-] is coerced to '-' and collapsed.
      expect(result.changedFiles[0].after).toMatch(/toolSlug: 'my-weird-name'/)
    })
  })

  it('dispatches rest-api type to the REST codemod', async () => {
    await withTmp(async (dir) => {
      const src = `import express from 'express'
const app = express()
app.get('/x', async (_req, res) => { res.json({}) })
app.listen(3000)
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'rest-dispatch', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)
      const result = await runTransform({
        rootDir: dir,
        detect: detect('rest-api'),
        dryRun: true,
      })
      expect(result.changedFiles.length).toBeGreaterThan(0)
      expect(result.changedFiles[0].after).toContain("method: 'get:/x'")
    })
  })

  it('dispatches langchain-tool type to the Langchain codemod', async () => {
    await withTmp(async (dir) => {
      const src = `import { StructuredTool } from '@langchain/core/tools'
class T extends StructuredTool {
  name = 't'
  description = 'd'
  schema = {} as never
  async _call(input: unknown): Promise<string> {
    return String(input)
  }
}
export { T }
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'langchain-dispatch', dependencies: {} }) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'tool.ts'), src)
      const result = await runTransform({
        rootDir: dir,
        detect: detect('langchain-tool'),
        dryRun: true,
      })
      expect(result.changedFiles.length).toBeGreaterThan(0)
      expect(result.changedFiles[0].after).toContain('method: this.name')
    })
  })

  it('WRITES to disk when dryRun is false and updates package.json', async () => {
    await withTmp(async (dir) => {
      const src = `import { Server } from '@modelcontextprotocol/sdk/server/index.js'
const server = new Server({ name: 'x', version: '0.0.0' })
server.setRequestHandler(ListToolsSchema, async () => ({ tools: [] }))
`
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'tgt', dependencies: { zod: '^3.22.0' } }, null, 2) + '\n',
      )
      await fsp.writeFile(path.join(dir, 'server.ts'), src)

      const result = await runTransform({
        rootDir: dir,
        detect: detect('mcp-server'),
        dryRun: false,
      })
      expect(result.changedFiles.length).toBeGreaterThan(0)

      const writtenSrc = await fsp.readFile(path.join(dir, 'server.ts'), 'utf-8')
      expect(writtenSrc).toContain("from '@settlegrid/mcp'")
      expect(writtenSrc).toContain('sg.wrap')

      const writtenPkg = JSON.parse(await fsp.readFile(path.join(dir, 'package.json'), 'utf-8')) as {
        dependencies: Record<string, string>
      }
      expect(writtenPkg.dependencies['@settlegrid/mcp']).toBe(SETTLEGRID_MCP_RANGE)
      expect(Object.keys(writtenPkg.dependencies)).toEqual([
        '@settlegrid/mcp',
        'zod',
      ])
    })
  })
})
