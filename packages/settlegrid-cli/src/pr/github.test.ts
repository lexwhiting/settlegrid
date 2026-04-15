import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import type { TransformOutput } from '../transforms/runner.js'
import { renderPrBody } from './body-template.js'
import {
  generatePatch,
  openPullRequest,
  parseGithubRepo,
  readGitOrigin,
} from './github.js'

// ─── Octokit mock ────────────────────────────────────────────────────────────
//
// Use hoisted vi.mock so every `new Octokit({...})` inside github.ts resolves
// to a stub whose method calls we can program per-test. The mock methods all
// live on a single shared object so the test body can configure return values
// and read call history without threading state through the test.

const octokitMethods = vi.hoisted(() => ({
  reposGet: vi.fn(),
  reposCreateFork: vi.fn(),
  gitGetRef: vi.fn(),
  gitGetCommit: vi.fn(),
  gitCreateRef: vi.fn(),
  gitCreateBlob: vi.fn(),
  gitCreateTree: vi.fn(),
  gitCreateCommit: vi.fn(),
  gitUpdateRef: vi.fn(),
  pullsCreate: vi.fn(),
}))

const OctokitCtor = vi.hoisted(() => vi.fn())

vi.mock('@octokit/rest', () => ({
  Octokit: OctokitCtor.mockImplementation(() => ({
    rest: {
      repos: {
        get: octokitMethods.reposGet,
        createFork: octokitMethods.reposCreateFork,
      },
      git: {
        getRef: octokitMethods.gitGetRef,
        getCommit: octokitMethods.gitGetCommit,
        createRef: octokitMethods.gitCreateRef,
        createBlob: octokitMethods.gitCreateBlob,
        createTree: octokitMethods.gitCreateTree,
        createCommit: octokitMethods.gitCreateCommit,
        updateRef: octokitMethods.gitUpdateRef,
      },
      pulls: {
        create: octokitMethods.pullsCreate,
      },
    },
  })),
}))

beforeEach(() => {
  OctokitCtor.mockClear()
  for (const fn of Object.values(octokitMethods)) {
    fn.mockReset()
  }
})

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_CHANGES: TransformOutput['changedFiles'] = [
  {
    path: 'src/server.ts',
    before:
      "import { Server } from '@modelcontextprotocol/sdk/server/index.js'\n" +
      "const server = new Server({ name: 'x', version: '0.0.0' })\n",
    after:
      "import { Server } from '@modelcontextprotocol/sdk/server/index.js'\n" +
      "import { settlegrid } from '@settlegrid/mcp'\n" +
      "const sg = settlegrid.init({ toolSlug: 'x', pricing: { defaultCostCents: 1 } })\n" +
      "const server = new Server({ name: 'x', version: '0.0.0' })\n",
  },
]

function programHappyPath(): void {
  octokitMethods.reposGet.mockResolvedValue({
    data: { permissions: { push: true } },
  })
  octokitMethods.gitGetRef.mockResolvedValue({
    data: { object: { sha: 'BASE_COMMIT_SHA', type: 'commit' } },
  })
  octokitMethods.gitGetCommit.mockResolvedValue({
    data: { tree: { sha: 'BASE_TREE_SHA' } },
  })
  octokitMethods.gitCreateRef.mockResolvedValue({ data: {} })
  octokitMethods.gitCreateBlob.mockResolvedValue({
    data: { sha: 'BLOB_SHA' },
  })
  octokitMethods.gitCreateTree.mockResolvedValue({
    data: { sha: 'NEW_TREE_SHA' },
  })
  octokitMethods.gitCreateCommit.mockResolvedValue({
    data: { sha: 'NEW_COMMIT_SHA' },
  })
  octokitMethods.gitUpdateRef.mockResolvedValue({ data: {} })
  octokitMethods.pullsCreate.mockResolvedValue({
    data: {
      html_url: 'https://github.com/acme/mcp-server/pull/42',
      number: 42,
    },
  })
}

async function withTmp<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), 'settlegrid-pr-'))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

// ─── openPullRequest — happy path ───────────────────────────────────────────

describe('openPullRequest — happy path (user has push access)', () => {
  it('creates branch + commit + PR on the upstream and returns the PR URL', async () => {
    programHappyPath()

    const result = await openPullRequest({
      repoOwner: 'acme',
      repoName: 'mcp-server',
      branchName: 'settlegrid/monetize',
      baseBranch: 'main',
      changes: DEFAULT_CHANGES,
      dependencyBump: { '@settlegrid/mcp': '^0.1.1' },
      envVarsRequired: ['SETTLEGRID_API_KEY'],
      token: 'ghs_happypath',
    })

    expect(result).toEqual({
      url: 'https://github.com/acme/mcp-server/pull/42',
      number: 42,
      forkUsed: false,
    })

    // Single Octokit instance constructed with the token.
    expect(OctokitCtor).toHaveBeenCalledTimes(1)
    expect(OctokitCtor).toHaveBeenCalledWith({ auth: 'ghs_happypath' })

    // Push-access check hits the upstream.
    expect(octokitMethods.reposGet).toHaveBeenCalledWith({
      owner: 'acme',
      repo: 'mcp-server',
    })
    // Fork is NOT attempted on the happy path.
    expect(octokitMethods.reposCreateFork).not.toHaveBeenCalled()

    // Branch + commit wired through git API.
    expect(octokitMethods.gitCreateRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'refs/heads/settlegrid/monetize',
        sha: 'BASE_COMMIT_SHA',
      }),
    )
    expect(octokitMethods.gitCreateBlob).toHaveBeenCalledTimes(1)
    expect(octokitMethods.gitCreateBlob).toHaveBeenCalledWith(
      expect.objectContaining({
        encoding: 'base64',
      }),
    )
    expect(octokitMethods.gitCreateTree).toHaveBeenCalledWith(
      expect.objectContaining({
        base_tree: 'BASE_TREE_SHA',
        tree: expect.arrayContaining([
          expect.objectContaining({
            path: 'src/server.ts',
            mode: '100644',
            type: 'blob',
            sha: 'BLOB_SHA',
          }),
        ]),
      }),
    )
    expect(octokitMethods.gitCreateCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'chore: monetize with SettleGrid',
        tree: 'NEW_TREE_SHA',
        parents: ['BASE_COMMIT_SHA'],
      }),
    )
    expect(octokitMethods.gitUpdateRef).toHaveBeenCalledWith(
      expect.objectContaining({
        ref: 'heads/settlegrid/monetize',
        sha: 'NEW_COMMIT_SHA',
      }),
    )

    // PR targets the upstream with bare branch name as head (no fork).
    expect(octokitMethods.pullsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'acme',
        repo: 'mcp-server',
        title: 'chore: monetize with SettleGrid',
        head: 'settlegrid/monetize',
        base: 'main',
      }),
    )
    // PR body is populated by renderPrBody.
    const pullCall = octokitMethods.pullsCreate.mock.calls[0][0]
    expect(pullCall.body).toContain('SettleGrid monetization')
    expect(pullCall.body).toContain('SETTLEGRID_API_KEY')
    expect(pullCall.body).toContain('@settlegrid/mcp@^0.1.1')
  })
})

// ─── openPullRequest — fork fallback ────────────────────────────────────────

describe('openPullRequest — fork fallback (no push access)', () => {
  it('forks, commits to the fork, and opens the PR with user:branch head', async () => {
    // First repos.get call (permission check) returns no push …
    // second call (fork readiness poll) returns OK.
    octokitMethods.reposGet
      .mockResolvedValueOnce({ data: { permissions: { push: false } } })
      .mockResolvedValueOnce({ data: { permissions: { push: true } } })

    octokitMethods.reposCreateFork.mockResolvedValue({
      data: {
        owner: { login: 'me' },
        name: 'mcp-server',
      },
    })

    octokitMethods.gitGetRef.mockResolvedValue({
      data: { object: { sha: 'FORK_BASE_SHA' } },
    })
    octokitMethods.gitGetCommit.mockResolvedValue({
      data: { tree: { sha: 'FORK_BASE_TREE_SHA' } },
    })
    octokitMethods.gitCreateRef.mockResolvedValue({ data: {} })
    octokitMethods.gitCreateBlob.mockResolvedValue({
      data: { sha: 'FORK_BLOB_SHA' },
    })
    octokitMethods.gitCreateTree.mockResolvedValue({
      data: { sha: 'FORK_TREE_SHA' },
    })
    octokitMethods.gitCreateCommit.mockResolvedValue({
      data: { sha: 'FORK_COMMIT_SHA' },
    })
    octokitMethods.gitUpdateRef.mockResolvedValue({ data: {} })
    octokitMethods.pullsCreate.mockResolvedValue({
      data: {
        html_url: 'https://github.com/acme/mcp-server/pull/7',
        number: 7,
      },
    })

    const result = await openPullRequest({
      repoOwner: 'acme',
      repoName: 'mcp-server',
      branchName: 'settlegrid/monetize',
      baseBranch: 'main',
      changes: DEFAULT_CHANGES,
      dependencyBump: { '@settlegrid/mcp': '^0.1.1' },
      envVarsRequired: ['SETTLEGRID_API_KEY'],
      token: 'ghs_forkpath',
    })

    expect(result.forkUsed).toBe(true)
    expect(result.number).toBe(7)
    expect(octokitMethods.reposCreateFork).toHaveBeenCalledTimes(1)

    // Tree / commit operations target the FORK owner (`me`), not upstream.
    expect(octokitMethods.gitCreateTree).toHaveBeenCalledWith(
      expect.objectContaining({ owner: 'me', repo: 'mcp-server' }),
    )
    // PR itself is filed against the UPSTREAM with cross-fork head.
    expect(octokitMethods.pullsCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: 'acme',
        repo: 'mcp-server',
        head: 'me:settlegrid/monetize',
        base: 'main',
      }),
    )
  })
})

// ─── --dry-run never touches GitHub API ─────────────────────────────────────

describe('dry-run zero-fetches invariant (add command)', () => {
  // P2.4 DoD: "--dry-run never touches the GitHub API (test asserts
  // zero fetches)". We drive the add command in-process via
  // program.parseAsync + the hoisted vi.mock('@octokit/rest'), then
  // assert the Octokit CONSTRUCTOR was never called — a strictly
  // stronger check than "no method call", since construction itself
  // would indicate the flow reached a PR branch.

  it('a dry-run add against a real fixture never instantiates Octokit', async () => {
    const { addCommand } = await import('../commands/add.js')
    const { Command } = await import('commander')
    const { fileURLToPath } = await import('node:url')

    const here = path.dirname(fileURLToPath(import.meta.url))
    const fixturePath = path.resolve(
      here,
      '..',
      'detect',
      'fixtures',
      'mcp-sample',
    )

    const program = new Command()
    addCommand(program)

    // Mute stdout/stderr so the clack prompts don't pollute the
    // vitest reporter. Restore afterward so test output still works.
    const origStdout = process.stdout.write.bind(process.stdout)
    const origStderr = process.stderr.write.bind(process.stderr)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = (() => true) as any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stderr.write = (() => true) as any

    const origExitCode = process.exitCode

    try {
      await program.parseAsync(
        ['add', '--path', fixturePath, '--dry-run'],
        { from: 'user' },
      )
    } finally {
      process.stdout.write = origStdout
      process.stderr.write = origStderr
      process.exitCode = origExitCode
    }

    // The strict invariant: Octokit was NEVER constructed in the
    // dry-run path. Any method call is a downstream symptom; this
    // catches a future refactor that lifts the Octokit() call above
    // the dry-run early return.
    expect(OctokitCtor).not.toHaveBeenCalled()
    // And — belt-and-suspenders — none of the stubbed methods saw
    // any calls either.
    for (const fn of Object.values(octokitMethods)) {
      expect(fn).not.toHaveBeenCalled()
    }
  })
})

// ─── openPullRequest — error contract ───────────────────────────────────────

describe('openPullRequest — error contract', () => {
  it('throws when token is missing', async () => {
    await expect(
      openPullRequest({
        repoOwner: 'acme',
        repoName: 'mcp-server',
        branchName: 'b',
        baseBranch: 'main',
        changes: DEFAULT_CHANGES,
        dependencyBump: {},
        envVarsRequired: [],
        token: '',
      }),
    ).rejects.toThrow(/token is required/)
    // No Octokit constructed, no API calls made.
    expect(OctokitCtor).not.toHaveBeenCalled()
  })

  it('throws when there are no changes to commit', async () => {
    await expect(
      openPullRequest({
        repoOwner: 'acme',
        repoName: 'mcp-server',
        branchName: 'b',
        baseBranch: 'main',
        changes: [],
        dependencyBump: {},
        envVarsRequired: [],
        token: 'ghs_empty',
      }),
    ).rejects.toThrow(/no changes to commit/)
    expect(OctokitCtor).not.toHaveBeenCalled()
  })

  it('never echoes the token through stdout/stderr or thrown error messages', async () => {
    // Program a failing upstream GET that mentions generic text —
    // the token must not leak into the propagated error string.
    octokitMethods.reposGet.mockRejectedValue(new Error('api timeout'))
    // repos.get throws → checkPushAccess returns false → fork attempt …
    octokitMethods.reposCreateFork.mockRejectedValue(
      new Error('fork rejected'),
    )

    const stdoutSpy = vi.spyOn(process.stdout, 'write').mockImplementation(
      () => true,
    )
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(
      () => true,
    )
    const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(
      () => {},
    )

    const secretToken = 'ghs_super_secret_never_log_this'

    let caught: unknown
    try {
      await openPullRequest({
        repoOwner: 'acme',
        repoName: 'mcp-server',
        branchName: 'b',
        baseBranch: 'main',
        changes: DEFAULT_CHANGES,
        dependencyBump: {},
        envVarsRequired: [],
        token: secretToken,
      })
    } catch (err) {
      caught = err
    }

    stdoutSpy.mockRestore()
    stderrSpy.mockRestore()
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()

    // Something threw (the fork fallback failed).
    expect(caught).toBeInstanceOf(Error)
    // The thrown message must NOT contain the token.
    expect((caught as Error).message).not.toContain(secretToken)
    // No console / stdout / stderr output during the call.
    expect(consoleLogSpy).not.toHaveBeenCalled()
    expect(consoleErrorSpy).not.toHaveBeenCalled()
    for (const call of stdoutSpy.mock.calls) {
      expect(String(call[0])).not.toContain(secretToken)
    }
    for (const call of stderrSpy.mock.calls) {
      expect(String(call[0])).not.toContain(secretToken)
    }
  })
})

// ─── renderPrBody snapshot ──────────────────────────────────────────────────

describe('renderPrBody — deterministic snapshot', () => {
  it('matches the inline snapshot for a representative transform output', () => {
    const body = renderPrBody({
      repoOwner: 'acme',
      repoName: 'mcp-server',
      changes: [
        {
          path: 'src/server.ts',
          before: 'old',
          after: 'new',
        },
        {
          path: 'src/tools/search.ts',
          before: 'old',
          after: 'new',
        },
      ],
      dependencyBump: { '@settlegrid/mcp': '^0.1.1' },
      envVarsRequired: ['SETTLEGRID_API_KEY'],
    })

    expect(body).toMatchInlineSnapshot(`
      "## SettleGrid monetization

      This pull request was generated by \`npx settlegrid add\` against
      \`acme/mcp-server\`. It wraps the repo's handlers
      with [SettleGrid](https://settlegrid.ai) so each invocation flows
      through a per-call billing ledger — no proxy, no sidecar, no runtime
      service dependency.

      ### Files changed (2)

      - \`src/server.ts\`
      - \`src/tools/search.ts\`

      ### Dependencies added

      - \`@settlegrid/mcp@^0.1.1\`

      These land in \`dependencies\` of your \`package.json\`. Run
      \`npm install\` (or \`pnpm install\` / \`yarn install\`) in the repo
      root before merging so the lockfile is updated.

      ### Environment variables required

      Set these in your deployment environment before the first wrapped
      call is served — SettleGrid will otherwise reject requests with an
      "API key missing" error:

      - \`SETTLEGRID_API_KEY\`

      ### How this works

      - Each wrapped handler (MCP \`setRequestHandler\`, LangChain \`_call\` /
        \`invoke\`, or REST \`app.<verb>\`) is replaced with \`sg.wrap(handler,
        { method })\` which charges before delegating to the original.
      - Pricing is configured in the \`settlegrid.init({ pricing })\` call
        inserted at the top of each wrapped file. Default is 1¢/call; add
        per-method overrides in the \`methods\` object (see the
        [pricing docs](https://settlegrid.ai/docs/pricing)).
      - SettleGrid validates the caller's API key from request headers or
        MCP metadata. If no key is present, the call 402s before your
        handler runs, so you never serve unpaid traffic.

      ### How to remove SettleGrid

      Revert this pull request with \`git revert\`, then run \`npm install\`
      to drop \`@settlegrid/mcp\` from the lockfile. There are no database
      migrations, no server-side state, and no vendor lock-in — reverting
      this commit restores the exact original behavior byte-for-byte.

      ---

      Generated by \`npx settlegrid add\`
      "
    `)
  })

  it('handles empty changes / deps / env inputs gracefully', () => {
    const body = renderPrBody({
      repoOwner: 'acme',
      repoName: 'mcp-server',
      changes: [],
      dependencyBump: {},
      envVarsRequired: [],
    })
    expect(body).toContain('(no files changed)')
    expect(body).toContain('Dependencies added')
    expect(body).toContain('Files changed (0)')
  })
})

// ─── parseGithubRepo ────────────────────────────────────────────────────────

describe('parseGithubRepo', () => {
  it('matches https URLs with and without .git suffix', () => {
    expect(parseGithubRepo('https://github.com/acme/mcp-server')).toEqual({
      owner: 'acme',
      name: 'mcp-server',
    })
    expect(
      parseGithubRepo('https://github.com/acme/mcp-server.git'),
    ).toEqual({ owner: 'acme', name: 'mcp-server' })
    expect(
      parseGithubRepo('https://github.com/acme/mcp-server/tree/main'),
    ).toEqual({ owner: 'acme', name: 'mcp-server' })
  })

  it('matches giget shorthand and ssh / git:// forms', () => {
    expect(parseGithubRepo('github:acme/mcp-server')).toEqual({
      owner: 'acme',
      name: 'mcp-server',
    })
    expect(parseGithubRepo('gh:acme/mcp-server')).toEqual({
      owner: 'acme',
      name: 'mcp-server',
    })
    expect(
      parseGithubRepo('git@github.com:acme/mcp-server.git'),
    ).toEqual({ owner: 'acme', name: 'mcp-server' })
    expect(
      parseGithubRepo('git://github.com/acme/mcp-server.git'),
    ).toEqual({ owner: 'acme', name: 'mcp-server' })
  })

  it('returns null for non-github URLs and unparseable input', () => {
    expect(parseGithubRepo('https://gitlab.com/acme/repo')).toBeNull()
    expect(parseGithubRepo('/tmp/local-dir')).toBeNull()
    expect(parseGithubRepo('')).toBeNull()
    expect(parseGithubRepo('not a url')).toBeNull()
  })
})

// ─── readGitOrigin ──────────────────────────────────────────────────────────

describe('readGitOrigin', () => {
  it('returns the origin URL from a standard .git/config', async () => {
    await withTmp(async (dir) => {
      const gitDir = path.join(dir, '.git')
      await fsp.mkdir(gitDir, { recursive: true })
      await fsp.writeFile(
        path.join(gitDir, 'config'),
        `[core]
\trepositoryformatversion = 0
[remote "origin"]
\turl = https://github.com/acme/mcp-server.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
[branch "main"]
\tremote = origin
`,
      )
      const url = await readGitOrigin(dir)
      expect(url).toBe('https://github.com/acme/mcp-server.git')
    })
  })

  it('returns null when there is no .git/config', async () => {
    await withTmp(async (dir) => {
      const url = await readGitOrigin(dir)
      expect(url).toBeNull()
    })
  })

  it('returns null when the config has no origin remote', async () => {
    await withTmp(async (dir) => {
      const gitDir = path.join(dir, '.git')
      await fsp.mkdir(gitDir, { recursive: true })
      await fsp.writeFile(
        path.join(gitDir, 'config'),
        '[core]\n\trepositoryformatversion = 0\n',
      )
      const url = await readGitOrigin(dir)
      expect(url).toBeNull()
    })
  })
})

// ─── generatePatch ──────────────────────────────────────────────────────────

describe('generatePatch', () => {
  it('produces a valid unified-diff per changed file with correct line counts', () => {
    // Hostile-review fix: a file ending in '\n' must be counted as
    // N content lines, not N+1. `"one\ntwo\n"` is 2 lines per git;
    // `"old\n"` is 1 line. The prior impl naively counted the empty
    // trailing entry from split('\n'), producing off-by-one hunk
    // headers AND a spurious trailing `-` / `+` empty line per file.
    const patch = generatePatch([
      {
        path: 'src/a.ts',
        before: 'one\ntwo\n',
        after: 'one\ntwo\nthree\n',
      },
      {
        path: 'src/b.ts',
        before: 'old\n',
        after: 'new\n',
      },
    ])
    expect(patch).toContain('diff --git a/src/a.ts b/src/a.ts')
    expect(patch).toContain('--- a/src/a.ts')
    expect(patch).toContain('+++ b/src/a.ts')
    // 2 content lines before, 3 after (git-correct counts).
    expect(patch).toContain('@@ -1,2 +1,3 @@')
    expect(patch).toContain('diff --git a/src/b.ts b/src/b.ts')
    // 1 content line before, 1 after.
    expect(patch).toContain('@@ -1,1 +1,1 @@')
    // And the trailing empty-line removal/addition artefact from
    // the prior impl must not appear.
    //   `-\n+` after the `-old` would be the signature of the bug.
    expect(patch).not.toMatch(/-old\n-\n/)
    expect(patch).not.toMatch(/\+new\n\+\n/)
  })

  it('handles files that do NOT end with a trailing newline', () => {
    // No-trailing-newline files keep every line as content.
    // `"abc"` is 1 line, `"abc\ndef"` is 2 lines.
    const patch = generatePatch([
      { path: 'x.ts', before: 'abc', after: 'abc\ndef' },
    ])
    expect(patch).toContain('@@ -1,1 +1,2 @@')
  })

  it('handles empty files cleanly (0-line hunks)', () => {
    const patch = generatePatch([
      { path: 'empty.ts', before: '', after: 'new content\n' },
    ])
    // 0 lines before → hunk header `-1,0`, 1 line after → `+1,1`
    expect(patch).toContain('@@ -1,0 +1,1 @@')
  })

  it('is deterministic for the same input', () => {
    const input: TransformOutput['changedFiles'] = [
      { path: 'x.ts', before: 'a\n', after: 'b\n' },
    ]
    expect(generatePatch(input)).toBe(generatePatch(input))
  })
})

describe('openPullRequest — error message clarity (hostile-review regression guards)', () => {
  // Each test here locks in a readable error surface for a common
  // failure mode that previously fell through to a cryptic Octokit
  // HTTPError message.

  it('surfaces a clear "repository not found" error when the upstream 404s', async () => {
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404 })
    octokitMethods.reposGet.mockRejectedValue(notFoundError)

    await expect(
      openPullRequest({
        repoOwner: 'acme',
        repoName: 'does-not-exist',
        branchName: 'b',
        baseBranch: 'main',
        changes: DEFAULT_CHANGES,
        dependencyBump: {},
        envVarsRequired: [],
        token: 'ghs_404test',
      }),
    ).rejects.toThrow(/repository acme\/does-not-exist not found/)

    // Fork attempt must NOT run — 404 short-circuits before it.
    expect(octokitMethods.reposCreateFork).not.toHaveBeenCalled()
  })

  it('surfaces a clear "base branch not found" error when getRef 404s', async () => {
    // Happy path through ensurePushAccess, then base branch 404.
    octokitMethods.reposGet.mockResolvedValue({
      data: { permissions: { push: true } },
    })
    const notFoundError = Object.assign(new Error('Not Found'), { status: 404 })
    octokitMethods.gitGetRef.mockRejectedValue(notFoundError)

    await expect(
      openPullRequest({
        repoOwner: 'acme',
        repoName: 'mcp-server',
        branchName: 'settlegrid/monetize',
        baseBranch: 'main',
        changes: DEFAULT_CHANGES,
        dependencyBump: {},
        envVarsRequired: [],
        token: 'ghs_basebranchtest',
      }),
    ).rejects.toThrow(
      /base branch 'main' not found in acme\/mcp-server/,
    )
  })

  it('surfaces a clear "branch already exists" error when createRef 422s', async () => {
    programHappyPath()
    // Override createRef to throw 422.
    const unprocessable = Object.assign(new Error('Unprocessable'), {
      status: 422,
    })
    octokitMethods.gitCreateRef.mockRejectedValue(unprocessable)

    await expect(
      openPullRequest({
        repoOwner: 'acme',
        repoName: 'mcp-server',
        branchName: 'settlegrid/monetize',
        baseBranch: 'main',
        changes: DEFAULT_CHANGES,
        dependencyBump: {},
        envVarsRequired: [],
        token: 'ghs_existing_branch',
      }),
    ).rejects.toThrow(
      /branch 'settlegrid\/monetize' already exists in acme\/mcp-server/,
    )
  })
})
