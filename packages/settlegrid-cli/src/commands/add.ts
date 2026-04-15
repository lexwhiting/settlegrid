import { Command } from 'commander'
import { intro, note, outro } from '@clack/prompts'
import kleur from 'kleur'
import {
  resolveSource,
  isGithubUrl,
  type ResolvedSource,
} from '../lib/source-resolver.js'
import { detectRepoType } from '../detect/index.js'

interface AddOptions {
  github?: string
  path?: string
  dryRun?: boolean
  pr: boolean
  outBranch?: string
  force?: boolean
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
    .option(
      '--force',
      'proceed even if repo type cannot be confidently detected',
      false,
    )
    .action(async (source: string | undefined, options: AddOptions) => {
      intro(kleur.cyan('settlegrid add'))

      // The positional [source] argument is a convenience: if it looks
      // like a remote URL, route it into resolveSource's `github` opt;
      // otherwise treat it as a local path. Explicit --github / --path
      // flags always win over the positional.
      const githubFromSource =
        source && isGithubUrl(source) ? source : undefined
      const pathFromSource =
        source && !isGithubUrl(source) ? source : undefined

      let resolved: ResolvedSource | null = null
      try {
        resolved = await resolveSource({
          github: options.github ?? githubFromSource,
          path: options.path ?? pathFromSource,
        })
        const detection = await detectRepoType(resolved.dir)

        const entryList =
          detection.entryPoints.length > 0
            ? detection.entryPoints.join(', ')
            : kleur.dim('(none)')
        const reasonList =
          detection.reasons.length > 0
            ? detection.reasons.map((r) => `\n                 - ${r}`).join('')
            : ` ${kleur.dim('(none)')}`

        const lines = [
          `source:       ${source ?? kleur.dim('(none)')}`,
          `resolved dir: ${resolved.dir}`,
          `type:         ${detection.type}`,
          `confidence:   ${detection.confidence.toFixed(2)}`,
          `language:     ${detection.language}`,
          `entry points: ${entryList}`,
          `reasons:      ${reasonList}`,
          '',
          `--github:     ${options.github ?? kleur.dim('(unset)')}`,
          `--path:       ${options.path ?? kleur.dim('(unset)')}`,
          `--dry-run:    ${options.dryRun ? 'yes' : 'no'}`,
          `--no-pr:      ${options.pr ? 'no (PR will be opened)' : 'yes (PR skipped)'}`,
          `--out-branch: ${options.outBranch ?? kleur.dim('(unset)')}`,
          `--force:      ${options.force ? 'yes' : 'no'}`,
        ]
        note(lines.join('\n'), 'detection + parsed options')

        if (detection.type === 'unknown' && !options.force) {
          outro(
            kleur.red(
              'unknown repo type — cannot auto-wrap. Re-run with --force to proceed anyway, or report the shape to support@settlegrid.ai.',
            ),
          )
          process.exitCode = 1
          return
        }

        outro(
          kleur.yellow(
            'not yet implemented — codemod and PR creation land in P2.3 through P2.4.',
          ),
        )
        process.exitCode = 0
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        outro(kleur.red(`settlegrid add failed: ${message}`))
        process.exitCode = 1
      } finally {
        if (resolved) {
          try {
            await resolved.cleanup()
          } catch {
            // Cleanup failure is non-fatal — tmpdirs get GC'd by the OS
            // eventually, and we shouldn't mask the primary outcome.
          }
        }
      }
    })
}
