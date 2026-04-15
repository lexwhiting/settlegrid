import { describe, it, expect } from 'vitest'
import { Command } from 'commander'
import { addCommand } from './add.js'

/**
 * Structural / unit tests for addCommand. These complement the binary
 * smoke tests in ../index.test.ts — they run in-process (no spawn), so
 * they verify the commander wiring quickly without hitting the built
 * dist. Run the full build + spawn suite via `npm test` at the package
 * root to exercise the compiled binary.
 */
describe('addCommand', () => {
  it('registers an `add` subcommand', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')
    expect(addCmd).toBeDefined()
  })

  it('declares all 5 P2.1 spec-required flags + the [source] positional', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')!
    const help = addCmd.helpInformation()

    // Per P2.1 spec #4: flags --github <url>, --path <dir>, --dry-run,
    // --no-pr, --out-branch <name> and a [source] positional.
    expect(help).toContain('[source]')
    expect(help).toContain('--github <url>')
    expect(help).toContain('--path <dir>')
    expect(help).toContain('--dry-run')
    expect(help).toContain('--no-pr')
    expect(help).toContain('--out-branch <name>')
  })

  it('carries a description referencing MCP + PR so `--help` is self-documenting', () => {
    const program = new Command()
    addCommand(program)

    const addCmd = program.commands.find((c) => c.name() === 'add')!
    // Loose regex — we care that the description mentions what the command
    // is for, not the exact wording (which may evolve across P2.2-P2.4).
    expect(addCmd.description()).toMatch(/MCP/i)
    expect(addCmd.description()).toMatch(/PR/i)
  })
})
