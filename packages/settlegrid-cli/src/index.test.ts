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
  it('prints version 0.1.0 with --version', () => {
    const result = spawnSync('node', [distEntry, '--version'], {
      encoding: 'utf-8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout.trim()).toMatch(/^0\.1\.0$/)
  })

  it('exits non-zero when given an unknown subcommand', () => {
    const result = spawnSync(
      'node',
      [distEntry, '__definitely-not-a-real-command__'],
      { encoding: 'utf-8' },
    )
    expect(result.status).not.toBe(0)
  })
})
