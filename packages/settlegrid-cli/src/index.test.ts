import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(here, '..')
const distEntry = path.resolve(packageRoot, 'dist', 'index.js')

beforeAll(() => {
  if (!existsSync(distEntry)) {
    execFileSync('npm', ['run', 'build'], {
      cwd: packageRoot,
      stdio: 'inherit',
    })
  }
})

describe('settlegrid CLI binary', () => {
  // Per P2.1 spec #5: one smoke test that spawns the built binary with
  // --version AND asserts non-zero exit on an unknown subcommand.
  it('prints 0.1.0 for --version and exits non-zero on an unknown subcommand', () => {
    const versionResult = spawnSync('node', [distEntry, '--version'], {
      encoding: 'utf-8',
    })
    expect(versionResult.status).toBe(0)
    expect(versionResult.stdout.trim()).toMatch(/^0\.1\.0$/)

    const unknownResult = spawnSync(
      'node',
      [distEntry, '__definitely-not-a-real-command__'],
      { encoding: 'utf-8' },
    )
    expect(unknownResult.status).not.toBe(0)
  })
})
