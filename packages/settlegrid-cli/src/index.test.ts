import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(here, '..')
const distEntry = path.resolve(packageRoot, 'dist', 'index.js')
const distCjsEntry = path.resolve(packageRoot, 'dist', 'index.cjs')

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

describe('settlegrid CLI binary', () => {
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

  // Regression guard for a hostile-review finding: the top-level IIFE used
  // to run unconditionally, so `require('@settlegrid/cli')` /
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

  // Coverage for the add-command stub's action handler: a fully-populated
  // invocation should exit 0 and echo every parsed option back through the
  // @clack/prompts `note` block plus the "not yet implemented" outro.
  // Exercises the positive branch of every `??` fallback in add.ts.
  it('runs `add` with every flag set and prints each value + "not yet implemented"', () => {
    const result = spawnSync(
      'node',
      [
        distEntry,
        'add',
        'my-source',
        '--github',
        'https://github.com/acme/mcp-server',
        '--path',
        '/tmp/settlegrid-test',
        '--dry-run',
        '--no-pr',
        '--out-branch',
        'settlegrid/monetize',
      ],
      { encoding: 'utf-8', env: testEnv },
    )
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('my-source')
    expect(result.stdout).toContain('https://github.com/acme/mcp-server')
    expect(result.stdout).toContain('/tmp/settlegrid-test')
    expect(result.stdout).toContain('dry-run:    yes')
    expect(result.stdout).toContain('no-pr:      yes (PR skipped)')
    expect(result.stdout).toContain('settlegrid/monetize')
    expect(result.stdout).toContain('not yet implemented')
  })

  // Coverage for the negative branches of the `??` fallbacks in add.ts:
  // when no source / --github / --path / --out-branch are provided, the
  // stub should show "(none)" / "(unset)" placeholders and still exit 0.
  it('runs `add` with no arguments and shows the unset placeholders, exit 0', () => {
    const result = spawnSync('node', [distEntry, 'add'], {
      encoding: 'utf-8',
      env: testEnv,
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('source:       (none)')
    expect(result.stdout).toContain('--github:     (unset)')
    expect(result.stdout).toContain('--path:       (unset)')
    expect(result.stdout).toContain('dry-run:    no')
    expect(result.stdout).toContain('no-pr:      no (PR will be opened)')
    expect(result.stdout).toContain('--out-branch: (unset)')
    expect(result.stdout).toContain('not yet implemented')
  })
})
