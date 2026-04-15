import { describe, it, expect } from 'vitest'
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

describe('resolveSource — local path branches', () => {
  it('resolves an explicit --path to an absolute directory with a no-op cleanup', async () => {
    await withTmp(async (dir) => {
      const result = await resolveSource({ path: dir })
      expect(result.dir).toBe(path.resolve(dir))
      expect(result.origin).toBe('path')
      await expect(result.cleanup()).resolves.toBeUndefined()
    })
  })

  it('resolves a positional non-URL source argument as a local path', async () => {
    await withTmp(async (dir) => {
      const result = await resolveSource({ source: dir })
      expect(result.dir).toBe(path.resolve(dir))
      expect(result.origin).toBe('path')
    })
  })

  it('prefers --path over a positional source argument', async () => {
    await withTmp(async (pathDir) => {
      await withTmp(async (sourceDir) => {
        const result = await resolveSource({ path: pathDir, source: sourceDir })
        expect(result.dir).toBe(path.resolve(pathDir))
      })
    })
  })
})

describe('resolveSource — error branches', () => {
  it('throws when neither --path, --github, nor source is provided', async () => {
    await expect(resolveSource({})).rejects.toThrow(/provide --path/)
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
  // Exercised via resolveSource when the source arg looks like a URL, which
  // would otherwise require a real giget fetch to unit-test. Direct tests on
  // the pure helper sidestep the network / filesystem dependency entirely.
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
