import { Command } from 'commander'
import { intro, note, outro } from '@clack/prompts'
import kleur from 'kleur'
import {
  resolveSource,
  isGithubUrl,
  type ResolvedSource,
} from '../lib/source-resolver.js'
import { detectRepoType } from '../detect/index.js'
import { runTransform } from '../transforms/runner.js'

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

        const detectionLines = [
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
        note(detectionLines.join('\n'), 'detection + parsed options')

        if (detection.type === 'unknown' && !options.force) {
          outro(
            kleur.red(
              'unknown repo type — cannot auto-wrap. Re-run with --force to proceed anyway, or report the shape to support@settlegrid.ai.',
            ),
          )
          process.exitCode = 1
          return
        }

        const transform = await runTransform({
          rootDir: resolved.dir,
          detect: detection,
          dryRun: options.dryRun === true,
        })

        const addedDeps = Object.entries(transform.addedDependencies)
          .map(([n, r]) => `${n}@${r}`)
          .join(', ')
        const changedList =
          transform.changedFiles.length > 0
            ? transform.changedFiles
                .map((c) => `\n                 - ${c.path}`)
                .join('')
            : ` ${kleur.dim('(none)')}`
        const skippedList =
          transform.skipped.length > 0
            ? transform.skipped
                .map((s) => `\n                 - ${s.path} (${s.reason})`)
                .join('')
            : ` ${kleur.dim('(none)')}`
        const envList =
          transform.envVarsRequired.length > 0
            ? transform.envVarsRequired.join(', ')
            : kleur.dim('(none)')

        const transformLines = [
          `mode:          ${options.dryRun ? kleur.yellow('dry-run (no files written)') : kleur.green('apply (files written)')}`,
          `changed files: ${changedList}`,
          `skipped files: ${skippedList}`,
          `deps to add:   ${addedDeps || kleur.dim('(none)')}`,
          `env required:  ${envList}`,
        ]
        note(transformLines.join('\n'), 'transform summary')

        // Emit an inline diff preview for dry-run so the user can eyeball
        // what would change without touching their working tree. Truncate
        // so the terminal doesn't get flooded on larger repos.
        if (options.dryRun === true && transform.changedFiles.length > 0) {
          const previewCount = Math.min(transform.changedFiles.length, 3)
          for (let i = 0; i < previewCount; i++) {
            const { path: rel, after } = transform.changedFiles[i]
            const truncated = after.length > 1200 ? after.slice(0, 1200) + '\n…' : after
            note(truncated, `preview: ${rel}`)
          }
          if (transform.changedFiles.length > previewCount) {
            note(
              `${transform.changedFiles.length - previewCount} more file(s) would change — re-run without --dry-run to apply.`,
              'preview (truncated)',
            )
          }
        }

        if (options.dryRun === true) {
          outro(
            kleur.yellow(
              'dry-run complete — re-run without --dry-run to write changes and update package.json.',
            ),
          )
        } else if (transform.changedFiles.length === 0) {
          outro(
            kleur.dim(
              'no files changed (already wrapped or nothing matched the codemod).',
            ),
          )
        } else {
          outro(
            kleur.green(
              `wrapped ${transform.changedFiles.length} file(s). Next: run \`npm install\` in the target repo, set ${transform.envVarsRequired.join(', ')}, and push.`,
            ),
          )
        }
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
