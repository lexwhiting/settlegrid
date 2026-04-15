import { Command } from 'commander'
import { intro, note, outro } from '@clack/prompts'
import kleur from 'kleur'
import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import {
  resolveSource,
  isGithubUrl,
  type ResolvedSource,
} from '../lib/source-resolver.js'
import { detectRepoType } from '../detect/index.js'
import { runTransform } from '../transforms/runner.js'
import {
  generatePatch,
  openPullRequest,
  parseGithubRepo,
  readGitOrigin,
} from '../pr/github.js'

interface AddOptions {
  github?: string
  path?: string
  dryRun?: boolean
  pr: boolean
  outBranch?: string
  force?: boolean
  token?: string
}

// Default when --out-branch is not supplied. Namespaced so we don't
// collide with common user branch names.
const DEFAULT_BRANCH_NAME = 'settlegrid/monetize'
const DEFAULT_BASE_BRANCH = 'main'

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
    .option(
      '--token <t>',
      'GitHub token for PR creation (falls back to GITHUB_TOKEN env var)',
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
          // --token is displayed as a boolean presence check so the token
          // value never reaches the terminal, even in --dry-run output.
          `--token:      ${options.token ? kleur.dim('(provided)') : kleur.dim('(unset)')}`,
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

        // --- Dry-run terminates here. Per P2.4 spec DoD:
        //     "--dry-run never touches the GitHub API" — we never
        //     reach the PR / patch branches below when dryRun is true.
        if (options.dryRun === true) {
          outro(
            kleur.yellow(
              'dry-run complete — re-run without --dry-run to write changes and update package.json.',
            ),
          )
          process.exitCode = 0
          return
        }

        // --- Apply path. Zero changes = nothing to PR/patch either.
        if (transform.changedFiles.length === 0) {
          outro(
            kleur.dim(
              'no files changed (already wrapped or nothing matched the codemod).',
            ),
          )
          process.exitCode = 0
          return
        }

        // --- PR decision tree.
        //
        //   1. --no-pr → skip PR entirely, just report the in-place writes
        //   2. --pr + repo info + token → open PR via openPullRequest
        //   3. --pr + (no repo info OR no token) → emit a .patch file to cwd
        //
        // The command flow DOES NOT log or display the token value anywhere
        // (see the '--token:' line above — presence only). Tests assert
        // token-never-logged by piping stdout/stderr through a substring
        // check against a sentinel token value.
        if (!options.pr) {
          outro(
            kleur.green(
              `wrapped ${transform.changedFiles.length} file(s) — skipped PR per --no-pr. Next: \`npm install\` + set ${transform.envVarsRequired.join(', ')}.`,
            ),
          )
          process.exitCode = 0
          return
        }

        const token = options.token ?? process.env.GITHUB_TOKEN
        const repoInfo = await deriveRepoInfo({
          github: options.github ?? githubFromSource,
          positionalSource: source,
          localDir: resolved.dir,
        })

        if (!token || !repoInfo) {
          // Graceful no-token (or no-repo-info) fallback — write a
          // .patch file the user can inspect and apply manually.
          const patchContent = generatePatch(transform.changedFiles)
          const patchPath = path.join(process.cwd(), 'settlegrid-add.patch')
          await fsp.writeFile(patchPath, patchContent, 'utf-8')
          const reason = !token
            ? 'no GITHUB_TOKEN set (pass --token or export GITHUB_TOKEN)'
            : 'no GitHub repo info (pass --github or run from a repo with an origin remote)'
          outro(
            kleur.yellow(
              `${reason} — wrote patch to ${patchPath}. Apply with \`git apply\` after reviewing.`,
            ),
          )
          process.exitCode = 0
          return
        }

        try {
          const pr = await openPullRequest({
            repoOwner: repoInfo.owner,
            repoName: repoInfo.name,
            branchName: options.outBranch ?? DEFAULT_BRANCH_NAME,
            baseBranch: DEFAULT_BASE_BRANCH,
            changes: transform.changedFiles,
            dependencyBump: transform.addedDependencies,
            envVarsRequired: transform.envVarsRequired,
            token,
          })
          outro(
            kleur.green(
              `opened PR ${pr.url}${pr.forkUsed ? kleur.dim(' (via fork)') : ''}`,
            ),
          )
          process.exitCode = 0
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          outro(kleur.red(`PR creation failed: ${message}`))
          process.exitCode = 1
        }
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

/**
 * Resolve the GitHub repo coordinates the PR flow should target.
 * Priority:
 *   1. `--github <url>` flag (already normalised into opts.github)
 *   2. Positional [source] that looks like a GitHub URL
 *   3. `.git/config` origin in the locally-resolved directory
 * Returns null when none of the above yield a parseable repo.
 */
async function deriveRepoInfo(args: {
  github?: string
  positionalSource?: string
  localDir: string
}): Promise<{ owner: string; name: string } | null> {
  if (args.github) {
    const parsed = parseGithubRepo(args.github)
    if (parsed) return parsed
  }
  if (args.positionalSource && isGithubUrl(args.positionalSource)) {
    const parsed = parseGithubRepo(args.positionalSource)
    if (parsed) return parsed
  }
  const origin = await readGitOrigin(args.localDir)
  if (origin) {
    const parsed = parseGithubRepo(origin)
    if (parsed) return parsed
  }
  return null
}
