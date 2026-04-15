import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { resolveSource, isGithubUrl } from './source-resolver.js'

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'settlegrid-resolver-'))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

// Hoisted mock for giget — dynamic import in source-resolver.ts resolves to
// this stub during tests, so the github branch runs without hitting the
// network. Per P2.2 spec: "giget fetch is wired but only exercised in tests
// via mock."
const downloadTemplateMock = vi.hoisted(() => vi.fn())
vi.mock('giget', () => ({ downloadTemplate: downloadTemplateMock }))

beforeEach(() => {
  downloadTemplateMock.mockReset()
})

describe('resolveSource — local path branch', () => {
  it('resolves an explicit --path to an absolute directory with a no-op cleanup', async () => {
    await withTmp(async (dir) => {
      const result = await resolveSource({ path: dir })
      expect(result.dir).toBe(path.resolve(dir))
      await expect(result.cleanup()).resolves.toBeUndefined()
    })
  })

  it('returns a resolved absolute path even when the input is relative', async () => {
    await withTmp(async (dir) => {
      const relativeDir = path.relative(process.cwd(), dir)
      const result = await resolveSource({ path: relativeDir })
      expect(path.isAbsolute(result.dir)).toBe(true)
      expect(result.dir).toBe(path.resolve(dir))
    })
  })
})

describe('resolveSource — github branch (giget mocked)', () => {
  it('fetches via giget into an os.tmpdir() subdir and cleanup removes it', async () => {
    downloadTemplateMock.mockImplementation(async (_src: string, opts: { dir: string }) => {
      // Simulate giget populating the target dir so cleanup has something
      // to remove and we can assert the path was inside os.tmpdir().
      await fsp.mkdir(opts.dir, { recursive: true })
      await fsp.writeFile(path.join(opts.dir, 'README.md'), '# stub')
      return { source: 'github:acme/repo', dir: opts.dir, name: 'repo' }
    })

    const result = await resolveSource({ github: 'github:acme/repo' })
    expect(path.isAbsolute(result.dir)).toBe(true)
    expect(result.dir.startsWith(os.tmpdir())).toBe(true)
    expect(downloadTemplateMock).toHaveBeenCalledWith(
      'github:acme/repo',
      expect.objectContaining({ force: true }),
    )
    // Fetched content should be visible pre-cleanup.
    await expect(fsp.access(path.join(result.dir, 'README.md'))).resolves.toBeUndefined()

    await result.cleanup()
    // tmpdir (parent of result.dir) should be removed after cleanup.
    await expect(fsp.access(result.dir)).rejects.toThrow()
  })
})

describe('resolveSource — error branches', () => {
  it('throws when neither --path nor --github is provided', async () => {
    await expect(resolveSource({})).rejects.toThrow(
      /provide --path <dir> or --github <url>/,
    )
  })

  it('throws when the --path target is a file, not a directory', async () => {
    await withTmp(async (dir) => {
      const filePath = path.join(dir, 'not-a-dir.txt')
      await fsp.writeFile(filePath, 'hello')
      await expect(resolveSource({ path: filePath })).rejects.toThrow(
        /not a directory/,
      )
    })
  })

  it('throws a readable error when the --path target does not exist', async () => {
    await expect(
      resolveSource({
        path: '/tmp/__settlegrid-definitely-not-a-real-dir__',
      }),
    ).rejects.toThrow(/does not exist/)
  })
})

describe('isGithubUrl', () => {
  // Exercised by the add command when routing its positional [source]
  // argument into the resolveSource opts. Direct unit tests sidestep
  // network / filesystem dependencies.
  it('matches http/https URLs', () => {
    expect(isGithubUrl('https://github.com/acme/repo')).toBe(true)
    expect(isGithubUrl('http://example.com/x')).toBe(true)
  })

  it('matches giget shorthand (github: / gh:) and git:// / git@', () => {
    expect(isGithubUrl('github:acme/repo')).toBe(true)
    expect(isGithubUrl('gh:acme/repo')).toBe(true)
    expect(isGithubUrl('git://example.com/repo.git')).toBe(true)
    expect(isGithubUrl('git@github.com:acme/repo.git')).toBe(true)
  })

  it('rejects local paths and plain strings', () => {
    expect(isGithubUrl('/tmp/foo')).toBe(false)
    expect(isGithubUrl('./local')).toBe(false)
    expect(isGithubUrl('../sibling')).toBe(false)
    expect(isGithubUrl('my-repo')).toBe(false)
    expect(isGithubUrl('')).toBe(false)
  })
})
