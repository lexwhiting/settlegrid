import { describe, it, expect } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { detectRepoType } from './index.js'

const here = path.dirname(fileURLToPath(import.meta.url))
const fixtureRoot = path.join(here, 'fixtures')

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'settlegrid-detect-'))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

describe('detectRepoType — fixtures', () => {
  it('classifies mcp-sample as mcp-server (confidence 0.95)', async () => {
    const result = await detectRepoType(path.join(fixtureRoot, 'mcp-sample'))
    expect(result.type).toBe('mcp-server')
    expect(result.confidence).toBeGreaterThanOrEqual(0.95)
    expect(result.language).toBe('ts')
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(
      result.reasons.some((r) => r.includes('@modelcontextprotocol/sdk')),
    ).toBe(true)
    expect(result.entryPoints).toContain('src/index.ts')
  })

  it('classifies langchain-sample as langchain-tool (confidence 0.9)', async () => {
    const result = await detectRepoType(path.join(fixtureRoot, 'langchain-sample'))
    expect(result.type).toBe('langchain-tool')
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
    expect(result.language).toBe('ts')
    expect(result.reasons.length).toBeGreaterThan(0)
    expect(result.reasons.some((r) => r.includes('langchain'))).toBe(true)
    expect(result.reasons.some((r) => r.includes('StructuredTool'))).toBe(true)
  })

  it('classifies rest-sample as rest-api (confidence 0.8)', async () => {
    const result = await detectRepoType(path.join(fixtureRoot, 'rest-sample'))
    expect(result.type).toBe('rest-api')
    expect(result.confidence).toBeGreaterThanOrEqual(0.8)
    // rest-sample has no `type: "module"` so the strict P2.2 language rule
    // classifies it as js even though the source file is now .ts.
    expect(result.language).toBe('js')
    expect(result.reasons.some((r) => r.includes('express'))).toBe(true)
  })

  it('classifies unknown-sample as unknown (confidence 0)', async () => {
    const result = await detectRepoType(path.join(fixtureRoot, 'unknown-sample'))
    expect(result.type).toBe('unknown')
    expect(result.confidence).toBe(0)
    expect(result.reasons.length).toBeGreaterThan(0)
  })
})

describe('detectRepoType — edge cases', () => {
  it('returns unknown for an empty directory with no package.json', async () => {
    await withTmp(async (dir) => {
      const result = await detectRepoType(dir)
      expect(result.type).toBe('unknown')
      expect(result.confidence).toBe(0)
      expect(result.language).toBe('unknown')
      expect(result.entryPoints).toEqual([])
    })
  })

  it('does not throw on malformed package.json', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(path.join(dir, 'package.json'), '{ this: is not json ')
      const result = await detectRepoType(dir)
      expect(result.type).toBe('unknown')
      expect(result.confidence).toBe(0)
    })
  })

  it('infers py language when pyproject.toml + .py files are present', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'pyproject.toml'),
        '[project]\nname = "py-sample"\n',
      )
      await fsp.writeFile(path.join(dir, 'main.py'), 'print("hi")\n')
      const result = await detectRepoType(dir)
      expect(result.language).toBe('py')
      expect(result.type).toBe('unknown')
    })
  })

  it('detects mcp-server via a source-file import even without the dependency declared', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'impl-only', dependencies: {} }),
      )
      await fsp.mkdir(path.join(dir, 'src'), { recursive: true })
      await fsp.writeFile(
        path.join(dir, 'src', 'server.ts'),
        "import { Server } from '@modelcontextprotocol/sdk/server/index.js'\nexport const s = new Server()\n",
      )
      const result = await detectRepoType(dir)
      expect(result.type).toBe('mcp-server')
      expect(result.confidence).toBeGreaterThanOrEqual(0.95)
      expect(result.reasons.some((r) => r.includes('src/server.ts'))).toBe(true)
    })
  })

  it('filters entry points to those that exist on disk', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'entry-sample',
          main: './dist/exists.js',
          module: './dist/missing.mjs',
          bin: { hello: './bin/hello.js' },
        }),
      )
      await fsp.mkdir(path.join(dir, 'dist'), { recursive: true })
      await fsp.writeFile(path.join(dir, 'dist', 'exists.js'), 'module.exports={}')
      await fsp.mkdir(path.join(dir, 'bin'), { recursive: true })
      await fsp.writeFile(path.join(dir, 'bin', 'hello.js'), 'console.log("hi")')
      const result = await detectRepoType(dir)
      expect(result.entryPoints).toContain('./dist/exists.js')
      expect(result.entryPoints).toContain('./bin/hello.js')
      expect(result.entryPoints).not.toContain('./dist/missing.mjs')
    })
  })
})

describe('detectRepoType — hostile input hardening', () => {
  // Regression guards for hostile-review findings — malformed / hostile
  // package.json shapes must fail safe, not crash or leak info.

  it('does not throw when package.json.dependencies is a string (malformed)', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'bad', dependencies: 'totally-not-an-object' }),
      )
      const result = await detectRepoType(dir)
      // `'x' in deps` would throw TypeError on a string operand; our
      // runtimeDeps guard must coerce malformed deps to {} so detection
      // completes with type=unknown instead.
      expect(result.type).toBe('unknown')
    })
  })

  it('does not throw when package.json.dependencies is an array', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({ name: 'bad', dependencies: ['express'] }),
      )
      const result = await detectRepoType(dir)
      expect(result.type).toBe('unknown')
    })
  })

  it('treats an array-shaped package.json as no package.json', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(path.join(dir, 'package.json'), '[]')
      const result = await detectRepoType(dir)
      expect(result.type).toBe('unknown')
      expect(result.entryPoints).toEqual([])
    })
  })

  it('rejects entry-point paths that escape rootDir (../../etc/passwd)', async () => {
    await withTmp(async (dir) => {
      // Put a real file at /tmp/<outside> and point `main` outside the repo.
      const outsideFile = path.join(os.tmpdir(), `settlegrid-outside-${Date.now()}.txt`)
      await fsp.writeFile(outsideFile, 'leak')
      try {
        const traversalTarget = path.relative(dir, outsideFile)
        await fsp.writeFile(
          path.join(dir, 'package.json'),
          JSON.stringify({ name: 'attack', main: traversalTarget }),
        )
        const result = await detectRepoType(dir)
        // Path resolves outside rootDir → must be excluded from entryPoints.
        expect(result.entryPoints).not.toContain(traversalTarget)
        expect(result.entryPoints).toEqual([])
      } finally {
        await fsp.rm(outsideFile, { force: true })
      }
    })
  })

  it('accepts a relative rootDir and resolves it to an absolute base', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(
        path.join(dir, 'package.json'),
        JSON.stringify({
          name: 'relrel',
          dependencies: { '@modelcontextprotocol/sdk': '^1.0.0' },
        }),
      )
      const cwd = process.cwd()
      process.chdir(path.dirname(dir))
      try {
        const relative = './' + path.basename(dir)
        const result = await detectRepoType(relative)
        expect(result.type).toBe('mcp-server')
      } finally {
        process.chdir(cwd)
      }
    })
  })
})
