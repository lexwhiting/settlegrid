import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import { existsSync } from 'node:fs'
import * as os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(here, '..')
const distEntry = path.resolve(packageRoot, 'dist', 'index.js')
const distCjsEntry = path.resolve(packageRoot, 'dist', 'index.cjs')
const fixtureRoot = path.resolve(here, 'detect', 'fixtures')

// Pin color env so commander / @clack/prompts output is deterministic
// across TTY, CI (FORCE_COLOR=1), and piped invocations.
const testEnv = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' }

beforeAll(() => {
  if (!existsSync(distEntry) || !existsSync(distCjsEntry)) {
    execFileSync('npm', ['run', 'build'], {
      cwd: packageRoot,
      stdio: 'inherit',
      // npm is a .cmd shim on Windows; execFileSync cannot resolve it
      // without a shell. On *nix, shell:false (default) finds npm normally.
      shell: process.platform === 'win32',
    })
  }
})

describe('settlegrid CLI binary — core smoke tests', () => {
  // Per P2.1 spec #5: a smoke test that spawns the built binary with
  // --version AND asserts non-zero exit on an unknown subcommand.
  it('prints 0.1.0 for --version and exits non-zero on an unknown subcommand', () => {
    const versionResult = spawnSync('node', [distEntry, '--version'], {
      encoding: 'utf-8',
      env: testEnv,
    })
    expect(versionResult.status).toBe(0)
    expect(versionResult.stdout.trim()).toMatch(/^0\.1\.0$/)

    const unknownResult = spawnSync(
      'node',
      [distEntry, '__definitely-not-a-real-command__'],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(unknownResult.status).not.toBe(0)
  })

  // Regression guard for a prior hostile-review finding: the top-level
  // IIFE used to run unconditionally, so `require('@settlegrid/cli')` /
  // `import '@settlegrid/cli'` would trigger Commander's auto-help and
  // process.exit(1) as a side effect of loading the module. Library
  // consumers must be able to load the package silently.
  it('does not execute the CLI when loaded as a library (CJS require + ESM import)', () => {
    const cjsProbe = spawnSync(
      'node',
      ['-e', `require(${JSON.stringify(distCjsEntry)})`],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(cjsProbe.status).toBe(0)
    expect(cjsProbe.stdout).toBe('')
    expect(cjsProbe.stderr).toBe('')

    const esmProbe = spawnSync(
      'node',
      [
        '--input-type=module',
        '-e',
        `await import(${JSON.stringify(distEntry)})`,
      ],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(esmProbe.status).toBe(0)
    expect(esmProbe.stdout).toBe('')
    expect(esmProbe.stderr).toBe('')
  })
})

describe('settlegrid add — detection + source resolution smoke tests', () => {
  // Combined coverage for:
  //   • P2.2 DoD #3: `settlegrid add ./fixture-mcp-sample --dry-run` prints
  //     the detected type.
  //   • P2.1-style option echoing: every parsed flag is displayed in the
  //     @clack/prompts note block.
  //   • --force on a non-unknown type is inert (exit 0 regardless).
  //   • P2.3: dry-run runs the codemod and emits a transform summary.
  // Consolidated into one spawn to reduce subprocess load when multiple
  // workspace tests run in parallel under turbo.
  it('detects mcp-server on --path fixture, echoes all flags, exits 0', () => {
    const result = spawnSync(
      'node',
      [
        distEntry,
        'add',
        'positional-marker',
        '--github',
        'https://github.com/acme/mcp-server',
        '--path',
        path.join(fixtureRoot, 'mcp-sample'),
        '--dry-run',
        '--no-pr',
        '--out-branch',
        'settlegrid/monetize',
        '--force',
      ],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(result.status).toBe(0)
    // Detection output per P2.2 spec
    expect(result.stdout).toContain('type:         mcp-server')
    expect(result.stdout).toContain('confidence:   0.95')
    expect(result.stdout).toContain('language:     ts')
    // Every flag echoed
    expect(result.stdout).toContain('positional-marker')
    expect(result.stdout).toContain('https://github.com/acme/mcp-server')
    expect(result.stdout).toContain('dry-run:    yes')
    expect(result.stdout).toContain('no-pr:      yes (PR skipped)')
    expect(result.stdout).toContain('settlegrid/monetize')
    expect(result.stdout).toContain('--force:      yes')
    // P2.3: transform summary + dry-run outro.
    expect(result.stdout).toContain('transform summary')
    expect(result.stdout).toContain('@settlegrid/mcp@^0.1.1')
    expect(result.stdout).toContain('SETTLEGRID_API_KEY')
    expect(result.stdout).toContain('dry-run complete')
  })

  // Per P2.2 step 6: unknown-type classification exits 1 without --force,
  // exit 0 with --force. Two related spawns consolidated into one test
  // case so the `--force` toggle semantics are asserted against the same
  // fixture in a single scope.
  it('honors the --force toggle on unknown-type classifications', () => {
    const unknownPath = path.join(fixtureRoot, 'unknown-sample')

    const woForce = spawnSync('node', [distEntry, 'add', '--path', unknownPath], {
      encoding: 'utf-8',
      env: testEnv,
    })
    expect(woForce.status).toBe(1)
    expect(woForce.stdout).toContain('type:         unknown')
    expect(woForce.stdout).toContain('--force')

    const withForce = spawnSync(
      'node',
      [distEntry, 'add', '--path', unknownPath, '--force'],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(withForce.status).toBe(0)
    expect(withForce.stdout).toContain('type:         unknown')
    // --force with unknown type → runner dispatches no codemod → 0 changes.
    // Outro message acknowledges nothing matched.
    expect(withForce.stdout).toContain('no files changed')
  })

  // Error path: no source / --path / --github supplied. resolveSource
  // throws and the add handler's try/catch maps that to exit 1 with a
  // readable message.
  it('exits 1 with a "provide --path" message when no source is supplied', () => {
    const result = spawnSync('node', [distEntry, 'add'], {
      encoding: 'utf-8',
      env: testEnv,
    })
    expect(result.status).toBe(1)
    expect(result.stdout).toContain('provide --path')
  })
})

describe('settlegrid add — P2.4 PR fallback + token-never-logged smoke tests', () => {
  // End-to-end fixtures at the spawn level: these exercise the P2.4
  // decision tree in the ACTUAL built binary, which is what CI and
  // end-users hit. In-process unit tests in src/pr/github.test.ts
  // cover the openPullRequest internals against a mocked Octokit;
  // these tests prove the CLI integration without any mocks.

  /**
   * Copy a fixture directory (rest-sample — detected as rest-api,
   * non-dry-run writes settlement init + wrap into the .ts file)
   * into a fresh tmpdir so the test can do a real write without
   * touching the source fixture.
   */
  async function copyRestFixture(): Promise<string> {
    const tmpParent = await fsp.mkdtemp(
      path.join(os.tmpdir(), 'settlegrid-p24-'),
    )
    const repoDir = path.join(tmpParent, 'repo')
    await fsp.mkdir(repoDir, { recursive: true })
    // Walk the fixture and copy each file manually (node <20 doesn't
    // have fsp.cp in all setups). The rest-sample fixture only has
    // package.json + src/index.ts — two files total.
    const fixtureSrc = path.join(fixtureRoot, 'rest-sample')
    const entries = await fsp.readdir(fixtureSrc, {
      withFileTypes: true,
      recursive: true,
    })
    for (const entry of entries) {
      const rel = path.relative(
        fixtureSrc,
        path.join(entry.parentPath ?? fixtureSrc, entry.name),
      )
      const srcPath = path.join(fixtureSrc, rel)
      const destPath = path.join(repoDir, rel)
      if (entry.isDirectory()) {
        await fsp.mkdir(destPath, { recursive: true })
      } else if (entry.isFile()) {
        await fsp.mkdir(path.dirname(destPath), { recursive: true })
        await fsp.copyFile(srcPath, destPath)
      }
    }
    return tmpParent
  }

  // P2.4 DoD: openPullRequest tests cover … "no-token graceful
  // patch-file fallback". Tested at the end-to-end CLI level here;
  // in-process tests in src/pr/github.test.ts cover the unit surface.
  it('falls back to writing a settlegrid-add.patch file when GITHUB_TOKEN is empty', async () => {
    const tmpParent = await copyRestFixture()
    try {
      const repoDir = path.join(tmpParent, 'repo')
      const result = spawnSync(
        'node',
        [distEntry, 'add', '--path', repoDir],
        {
          encoding: 'utf-8',
          // cwd is where the fallback patch file lands. Use the
          // tmpdir parent so we can assert on the file path +
          // clean up deterministically.
          cwd: tmpParent,
          env: { ...testEnv, GITHUB_TOKEN: '' },
        },
      )
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('no GITHUB_TOKEN set')
      expect(result.stdout).toContain('settlegrid-add.patch')

      const patchPath = path.join(tmpParent, 'settlegrid-add.patch')
      const patchStat = await fsp.stat(patchPath)
      expect(patchStat.isFile()).toBe(true)
      expect(patchStat.size).toBeGreaterThan(0)

      const patchContent = await fsp.readFile(patchPath, 'utf-8')
      expect(patchContent).toContain('diff --git a/src/index.ts b/src/index.ts')
      expect(patchContent).toContain('+import { settlegrid }')
    } finally {
      await fsp.rm(tmpParent, { recursive: true, force: true })
    }
  })

  // P2.4 DoD: "Token never logged or echoed to stdout (grep check
  // in test)". The unit test in src/pr/github.test.ts uses console/
  // stdout spies for openPullRequest itself; this test is the
  // end-to-end grep check the spec literally asks for — spawn the
  // binary with a sentinel token in --token AND GITHUB_TOKEN, then
  // grep the captured stdout+stderr for the sentinel substring.
  it('never echoes --token or GITHUB_TOKEN values to stdout/stderr', async () => {
    const tmpParent = await copyRestFixture()
    try {
      const repoDir = path.join(tmpParent, 'repo')
      const TOKEN_FLAG = 'ghs_sentinel_FLAG_never_log_this_123'
      const TOKEN_ENV = 'ghs_sentinel_ENV_never_log_this_456'
      const result = spawnSync(
        'node',
        [
          distEntry,
          'add',
          '--path',
          repoDir,
          '--token',
          TOKEN_FLAG,
          '--dry-run',
        ],
        {
          encoding: 'utf-8',
          cwd: tmpParent,
          env: { ...testEnv, GITHUB_TOKEN: TOKEN_ENV },
        },
      )
      expect(result.status).toBe(0)
      // Both token values must be completely absent from captured
      // output. Grep check via .not.toContain.
      expect(result.stdout).not.toContain(TOKEN_FLAG)
      expect(result.stdout).not.toContain(TOKEN_ENV)
      expect(result.stderr).not.toContain(TOKEN_FLAG)
      expect(result.stderr).not.toContain(TOKEN_ENV)
      // And the token display line shows the boolean presence form,
      // proving the CLI DID see the flag (otherwise the line would
      // say "(unset)").
      expect(result.stdout).toContain('--token:')
      expect(result.stdout).toContain('(provided)')
    } finally {
      await fsp.rm(tmpParent, { recursive: true, force: true })
    }
  })
})
