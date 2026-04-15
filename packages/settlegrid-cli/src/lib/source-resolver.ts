import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

export interface ResolvedSource {
  dir: string
  cleanup: () => Promise<void>
  origin: 'path' | 'github'
}

export interface ResolveSourceOpts {
  /** Explicit local path (takes priority over `source` / `github`). */
  path?: string
  /** Explicit GitHub URL or `owner/repo` shorthand (giget-compatible). */
  github?: string
  /**
   * Positional source argument from the CLI. Treated as a GitHub URL when
   * it matches http(s)://, github:, or git@ schemes; otherwise as a local
   * filesystem path.
   */
  source?: string
}

/**
 * Resolve a `settlegrid add` source argument (local path or GitHub URL) to
 * a concrete on-disk directory. For GitHub sources this fetches into a new
 * subdir of os.tmpdir() via giget; the caller is responsible for invoking
 * `cleanup()` once detection + codemod are done (the add handler does so
 * in a `finally` block).
 */
export async function resolveSource(
  opts: ResolveSourceOpts,
): Promise<ResolvedSource> {
  const localPath =
    opts.path ??
    (opts.source && !isGithubUrl(opts.source) ? opts.source : undefined)
  const githubUrl =
    opts.github ?? (opts.source && isGithubUrl(opts.source) ? opts.source : undefined)

  if (localPath) {
    const resolved = path.resolve(localPath)
    let stat: Awaited<ReturnType<typeof fsp.stat>>
    try {
      stat = await fsp.stat(resolved)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      throw new Error(`path does not exist: ${resolved} (${message})`)
    }
    if (!stat.isDirectory()) {
      throw new Error(`path is not a directory: ${resolved}`)
    }
    return { dir: resolved, origin: 'path', cleanup: async () => {} }
  }

  if (githubUrl) {
    const tmpParent = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'settlegrid-cli-gh-'),
    )
    const target = path.join(tmpParent, 'repo')
    // Dynamic import keeps giget out of the require graph for callers that
    // never need a GitHub fetch (e.g. `--path` only) and makes vitest mocks
    // easy to apply when needed.
    const giget = await import('giget')
    await giget.downloadTemplate(githubUrl, { dir: target, force: true })
    return {
      dir: target,
      origin: 'github',
      cleanup: async () => {
        await fsp.rm(tmpParent, { recursive: true, force: true })
      },
    }
  }

  throw new Error(
    'settlegrid add: provide --path <dir>, --github <url>, or a positional source',
  )
}

/**
 * Return true if `s` looks like a remote VCS URL (https/http, git@ SSH,
 * or giget's `github:` / `gh:` / `git://` shorthand). Exported for
 * direct unit testing without going through giget / the filesystem.
 */
export function isGithubUrl(s: string): boolean {
  return /^(https?:\/\/|github:|gh:|git@|git:\/\/)/.test(s)
}
