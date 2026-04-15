import { describe, it, expect } from 'vitest'
import { Command } from 'commander'
import { addCommand } from './add.js'

/**
 * Structural / unit tests for addCommand. These complement the binary
 * smoke tests in ../index.test.ts — they run in-process (no spawn), so
 * they verify the commander wiring quickly without hitting the built
 * dist. Run the full build + spawn suite via `npm test` at the package
 * root to exercise the compiled binary end-to-end.
 */
describe('addCommand', () => {
  it('registers an `add` subcommand', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')
    expect(addCmd).toBeDefined()
  })

  it('declares the [source] positional + all 6 spec-required flags (P2.1 + P2.2)', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')!
    const help = addCmd.helpInformation()

    // Per P2.1 spec #4: positional + 5 original flags.
    expect(help).toContain('[source]')
    expect(help).toContain('--github <url>')
    expect(help).toContain('--path <dir>')
    expect(help).toContain('--dry-run')
    expect(help).toContain('--no-pr')
    expect(help).toContain('--out-branch <name>')
    // Per P2.2 step 6: --force bypasses the unknown-type guard.
    expect(help).toContain('--force')
  })

  it('carries a description referencing MCP + PR so `--help` is self-documenting', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')!
    expect(addCmd.description()).toMatch(/MCP/i)
    expect(addCmd.description()).toMatch(/PR/i)
  })
})
