import { Command } from 'commander'
import { intro, note, outro } from '@clack/prompts'
import kleur from 'kleur'

interface AddOptions {
  github?: string
  path?: string
  dryRun?: boolean
  pr: boolean
  outBranch?: string
}

export function addCommand(program: Command): void {
  program
    .command('add [source]')
    .description(
      'Monetize an MCP repo by wrapping its handlers with sg.wrap() and (optionally) opening a PR.',
    )
    .option('--github <url>', 'GitHub repo URL to clone and monetize')
    .option('--path <dir>', 'local directory containing the MCP repo')
    .option('--dry-run', 'print intended changes without writing files', false)
    .option('--no-pr', 'skip opening a pull request after the codemod')
    .option('--out-branch <name>', 'branch name for the generated PR')
    .action(async (source: string | undefined, options: AddOptions) => {
      intro(kleur.cyan('settlegrid add'))

      const lines = [
        `source:       ${source ?? kleur.dim('(none)')}`,
        `--github:     ${options.github ?? kleur.dim('(unset)')}`,
        `--path:       ${options.path ?? kleur.dim('(unset)')}`,
        `--dry-run:    ${options.dryRun ? 'yes' : 'no'}`,
        `--no-pr:      ${options.pr ? 'no (PR will be opened)' : 'yes (PR skipped)'}`,
        `--out-branch: ${options.outBranch ?? kleur.dim('(unset)')}`,
      ]
      note(lines.join('\n'), 'parsed options')

      outro(
        kleur.yellow(
          'not yet implemented — detection, codemod, and PR creation land in P2.2 through P2.4.',
        ),
      )
      process.exit(0)
    })
}
