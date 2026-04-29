import { describe, it, expect } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  compareSnapshots,
  listDirEntries,
  snapshotTree,
  validateTarget,
} from './smoke.js'

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'settlegrid-smoke-test-'))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

// ─── validateTarget ─────────────────────────────────────────────────────────

describe('validateTarget — shape guards for smoke-targets.json entries', () => {
  const goodTarget = {
    name: 'mcp-x',
    github: 'acme/mcp-x',
    subdir: 'src/x',
    commit: 'abc123',
    expectedType: 'mcp-server',
    expectedLanguage: 'ts',
    expectedMinChangedFiles: 1,
    notes: 'test',
  }

  it('accepts a fully-populated target', () => {
    const t = validateTarget(goodTarget, 0)
    expect(t.name).toBe('mcp-x')
    expect(t.github).toBe('acme/mcp-x')
    expect(t.subdir).toBe('src/x')
    expect(t.commit).toBe('abc123')
    expect(t.expectedType).toBe('mcp-server')
    expect(t.expectedLanguage).toBe('ts')
    expect(t.expectedMinChangedFiles).toBe(1)
    expect(t.notes).toBe('test')
  })

  it('accepts a target without optional subdir / notes', () => {
    const t = validateTarget(
      {
        name: 'langchain-y',
        github: 'acme/langchain-y',
        commit: 'def456',
        expectedType: 'langchain-tool',
        expectedLanguage: 'ts',
        expectedMinChangedFiles: 0,
      },
      3,
    )
    expect(t.subdir).toBeUndefined()
    expect(t.notes).toBeUndefined()
    expect(t.expectedMinChangedFiles).toBe(0)
  })

  it('rejects non-object top-level input', () => {
    expect(() => validateTarget('not an object', 0)).toThrow(
      /target\[0\] must be an object/,
    )
    expect(() => validateTarget(null, 0)).toThrow(/must be an object/)
    expect(() => validateTarget([1, 2, 3], 0)).toThrow(/must be an object/)
  })

  it('rejects missing or empty string fields with an index + name prefix', () => {
    expect(() => validateTarget({ ...goodTarget, name: '' }, 2)).toThrow(
      /target\[2\] missing or empty string field: name/,
    )
    expect(() =>
      validateTarget({ ...goodTarget, github: 123 }, 4),
    ).toThrow(/target\[4\] missing or empty string field: github/)
    expect(() =>
      validateTarget({ ...goodTarget, commit: undefined }, 1),
    ).toThrow(/commit/)
  })

  it('rejects invalid expectedType values with the named target', () => {
    expect(() =>
      validateTarget({ ...goodTarget, expectedType: 'python-tool' }, 5),
    ).toThrow(/target\[5\] \(mcp-x\) invalid expectedType: python-tool/)
  })

  it('rejects invalid expectedLanguage values', () => {
    expect(() =>
      validateTarget({ ...goodTarget, expectedLanguage: 'ruby' }, 6),
    ).toThrow(/invalid expectedLanguage: ruby/)
  })

  it('rejects non-integer / negative expectedMinChangedFiles', () => {
    expect(() =>
      validateTarget({ ...goodTarget, expectedMinChangedFiles: 1.5 }, 0),
    ).toThrow(/expectedMinChangedFiles must be a non-negative integer/)
    expect(() =>
      validateTarget({ ...goodTarget, expectedMinChangedFiles: -1 }, 0),
    ).toThrow(/expectedMinChangedFiles must be a non-negative integer/)
    expect(() =>
      validateTarget({ ...goodTarget, expectedMinChangedFiles: 'one' }, 0),
    ).toThrow(/expectedMinChangedFiles must be a non-negative integer/)
  })

  it('rejects non-string subdir / notes when provided', () => {
    expect(() =>
      validateTarget({ ...goodTarget, subdir: 42 }, 0),
    ).toThrow(/subdir must be a string when provided/)
    expect(() =>
      validateTarget({ ...goodTarget, notes: 42 }, 0),
    ).toThrow(/notes must be a string when provided/)
  })
})

// ─── compareSnapshots ───────────────────────────────────────────────────────

describe('compareSnapshots — mtime + size diff detection', () => {
  it('returns an empty mutation list when before === after', () => {
    const snap = new Map([
      ['a.ts', { size: 10, mtimeMs: 1000 }],
      ['b.ts', { size: 20, mtimeMs: 2000 }],
    ])
    expect(compareSnapshots(snap, new Map(snap))).toEqual([])
  })

  it('flags a file that disappeared as "deleted:"', () => {
    const before = new Map([
      ['a.ts', { size: 10, mtimeMs: 1000 }],
      ['b.ts', { size: 20, mtimeMs: 2000 }],
    ])
    const after = new Map([['a.ts', { size: 10, mtimeMs: 1000 }]])
    const mutations = compareSnapshots(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toMatch(/^deleted: b\.ts$/)
  })

  it('flags a new file as "created:"', () => {
    const before = new Map([['a.ts', { size: 10, mtimeMs: 1000 }]])
    const after = new Map([
      ['a.ts', { size: 10, mtimeMs: 1000 }],
      ['new.ts', { size: 5, mtimeMs: 3000 }],
    ])
    const mutations = compareSnapshots(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toMatch(/^created: new\.ts$/)
  })

  it('flags a size OR mtime change as a SINGLE "mutated:" entry per file', () => {
    // Regression guard for the prior bug where size + mtime changes
    // emitted two separate lines; now it's one consolidated line.
    const before = new Map([['a.ts', { size: 10, mtimeMs: 1000 }]])
    const after = new Map([['a.ts', { size: 15, mtimeMs: 2000 }]])
    const mutations = compareSnapshots(before, after)
    expect(mutations).toHaveLength(1)
    expect(mutations[0]).toContain('mutated: a.ts')
    expect(mutations[0]).toContain('size 10→15')
    expect(mutations[0]).toContain('mtime 1000→2000')
  })

  it('flags a size-only change', () => {
    const before = new Map([['a.ts', { size: 10, mtimeMs: 1000 }]])
    const after = new Map([['a.ts', { size: 11, mtimeMs: 1000 }]])
    expect(compareSnapshots(before, after)).toEqual([
      expect.stringMatching(/mutated: a\.ts/),
    ])
  })

  it('flags an mtime-only change (touch-only file)', () => {
    const before = new Map([['a.ts', { size: 10, mtimeMs: 1000 }]])
    const after = new Map([['a.ts', { size: 10, mtimeMs: 1500 }]])
    expect(compareSnapshots(before, after)).toEqual([
      expect.stringMatching(/mutated: a\.ts/),
    ])
  })
})

// ─── listDirEntries ─────────────────────────────────────────────────────────

describe('listDirEntries', () => {
  it('returns sorted immediate children of a directory', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(path.join(dir, 'zeta.txt'), 'z')
      await fsp.writeFile(path.join(dir, 'alpha.txt'), 'a')
      await fsp.mkdir(path.join(dir, 'middle'), { recursive: true })
      const entries = await listDirEntries(dir)
      expect(entries).toEqual(['alpha.txt', 'middle', 'zeta.txt'])
    })
  })

  it('returns an empty array when the directory does not exist', async () => {
    const entries = await listDirEntries(
      '/tmp/__smoke-definitely-does-not-exist__',
    )
    expect(entries).toEqual([])
  })
})

// ─── snapshotTree ───────────────────────────────────────────────────────────

describe('snapshotTree', () => {
  it('walks a directory and records size + mtime per file', async () => {
    await withTmp(async (dir) => {
      await fsp.writeFile(path.join(dir, 'a.ts'), 'abc')
      await fsp.mkdir(path.join(dir, 'sub'), { recursive: true })
      await fsp.writeFile(path.join(dir, 'sub', 'b.ts'), 'defg')
      const snap = await snapshotTree(dir)
      expect(snap.get('a.ts')?.size).toBe(3)
      expect(snap.get(path.join('sub', 'b.ts'))?.size).toBe(4)
    })
  })

  it('skips .git and node_modules directories', async () => {
    await withTmp(async (dir) => {
      await fsp.mkdir(path.join(dir, '.git'), { recursive: true })
      await fsp.writeFile(path.join(dir, '.git', 'HEAD'), 'ref: refs/heads/main')
      await fsp.mkdir(path.join(dir, 'node_modules', 'x'), { recursive: true })
      await fsp.writeFile(
        path.join(dir, 'node_modules', 'x', 'index.js'),
        'module.exports={}',
      )
      await fsp.writeFile(path.join(dir, 'real.ts'), 'real')
      const snap = await snapshotTree(dir)
      expect(snap.has('real.ts')).toBe(true)
      // .git and node_modules contents excluded.
      for (const key of snap.keys()) {
        expect(key).not.toMatch(/^\.git/)
        expect(key).not.toMatch(/^node_modules/)
      }
    })
  })

  it('returns an empty snapshot for a missing directory without throwing', async () => {
    const snap = await snapshotTree(
      '/tmp/__smoke-also-does-not-exist__',
    )
    expect(snap.size).toBe(0)
  })
})
