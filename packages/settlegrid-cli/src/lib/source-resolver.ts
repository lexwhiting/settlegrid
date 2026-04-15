import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

export interface ResolvedSource {
  dir: string
  cleanup: () => Promise<void>
}

export interface ResolveSourceOpts {
  /** Explicit local path (takes priority over `github`). */
  path?: string
  /** Explicit GitHub URL or `owner/repo` shorthand (giget-compatible). */
  github?: string
}

/**
 * Resolve a `settlegrid add` source to a concrete on-disk directory.
 * For GitHub sources this fetches into a new subdir of os.tmpdir() via
 * giget; the caller is responsible for invoking `cleanup()` once
 * detection + codemod are done (the add handler does so in a `finally`
 * block).
 *
 * Signature matches P2.2 spec step 5:
 *   resolveSource(opts: { path?: string; github?: string }):
 *     Promise<{ dir: string; cleanup: () => Promise<void> }>
 *
 * The add command routes its positional `[source]` into `path` or
 * `github` via isGithubUrl before calling in; resolveSource itself
 * only recognises the two named opts.
 */
export async function resolveSource(
  opts: ResolveSourceOpts,
): Promise<ResolvedSource> {
  if (opts.path) {
    const resolved = path.resolve(opts.path)
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
    return { dir: resolved, cleanup: async () => {} }
  }

  if (opts.github) {
    const tmpParent = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'settlegrid-cli-gh-'),
    )
    const target = path.join(tmpParent, 'repo')
    try {
      // Dynamic import keeps giget out of the require graph for callers
      // that never need a GitHub fetch (e.g. `--path` only) and makes
      // vitest mocks easy to apply when needed.
      const giget = await import('giget')
      await giget.downloadTemplate(opts.github, { dir: target, force: true })
    } catch (err) {
      // Clean up the mkdtemp we just created before re-throwing, so a
      // transient network or bad-URL failure doesn't leak tmpdirs. The
      // rm is itself best-effort — if it fails the OS tmp-GC will reap.
      await fsp.rm(tmpParent, { recursive: true, force: true }).catch(() => {})
      throw err
    }
    return {
      dir: target,
      cleanup: async () => {
        await fsp.rm(tmpParent, { recursive: true, force: true })
      },
    }
  }

  throw new Error('provide --path <dir> or --github <url>')
}

/**
 * Return true if `s` looks like a remote VCS URL (https/http, git@ SSH,
 * or giget's `github:` / `gh:` / `git://` shorthand). Exported so the
 * add command can route its positional [source] argument into the
 * appropriate resolveSource opt before calling in.
 *
 * Case-insensitive per RFC 3986 — accepts `HTTPS://...` as well as the
 * conventional lowercase form.
 */
export function isGithubUrl(s: string): boolean {
  return /^(https?:\/\/|github:|gh:|git@|git:\/\/)/i.test(s)
}
