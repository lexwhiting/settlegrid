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
  it('returns false for unrelated source', () => {
    expect(isAlreadyWrapped('export const noop = () => undefined\n')).toBe(false)
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
