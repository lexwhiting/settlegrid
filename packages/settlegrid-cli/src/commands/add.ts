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
import { detectRepoType, type DetectResult } from '../detect/index.js'
import { runTransform, type TransformOutput } from '../transforms/runner.js'
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
  json?: boolean
}

// Default when --out-branch is not supplied. Namespaced so we don't
// collide with common user branch names.
const DEFAULT_BRANCH_NAME = 'settlegrid/monetize'
const DEFAULT_BASE_BRANCH = 'main'

/**
 * Machine-readable record emitted to stdout when --json is set.
 * Consumed by `scripts/smoke.ts` (P2.5) to assert per-repo detection
 * + transformation results across the pinned smoke targets.
 */
interface JsonResult {
  status:
    | 'dry-run-complete'
    | 'applied'
    | 'no-changes'
    | 'skipped-pr'
    | 'pr-opened'
    | 'patch-file-written'
    | 'pr-failed'
    | 'unknown-type'
    | 'error'
  mode: 'dry-run' | 'apply'
  resolvedDir: string | null
  detect: DetectResult | null
  transform: TransformOutput | null
  pr: {
    url: string
    number: number
    forkUsed: boolean
  } | null
  patchFile: string | null
  error: string | null
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
    .option(
      '--token <t>',
      'GitHub token for PR creation (falls back to GITHUB_TOKEN env var)',
    )
    .option(
      '--json',
      'emit machine-readable JSON output (suppresses human prompts)',
      false,
    )
    .action(async (source: string | undefined, options: AddOptions) => {
      const jsonMode = options.json === true

      // Build up the JsonResult record as we go. The fields land on
      // stdout as a single JSON line just before the action handler
      // returns, when jsonMode is on.
      const json: JsonResult = {
        status: 'error',
        mode: options.dryRun === true ? 'dry-run' : 'apply',
        resolvedDir: null,
        detect: null,
        transform: null,
        pr: null,
        patchFile: null,
        error: null,
      }
      const emitJson = (): void => {
        if (jsonMode) {
          process.stdout.write(JSON.stringify(json) + '\n')
        }
      }

      if (!jsonMode) {
        intro(kleur.cyan('settlegrid add'))
      }

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
        json.resolvedDir = resolved.dir

        const detection = await detectRepoType(resolved.dir)
        json.detect = detection

        if (!jsonMode) {
          const entryList =
            detection.entryPoints.length > 0
              ? detection.entryPoints.join(', ')
              : kleur.dim('(none)')
          const reasonList =
            detection.reasons.length > 0
              ? detection.reasons
                  .map((r) => `\n                 - ${r}`)
                  .join('')
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
            `--token:      ${options.token ? kleur.dim('(provided)') : kleur.dim('(unset)')}`,
          ]
          note(detectionLines.join('\n'), 'detection + parsed options')
        }

        if (detection.type === 'unknown' && !options.force) {
          if (!jsonMode) {
            outro(
              kleur.red(
                'unknown repo type — cannot auto-wrap. Re-run with --force to proceed anyway, or report the shape to support@settlegrid.ai.',
              ),
            )
          }
          json.status = 'unknown-type'
          json.error =
            'unknown repo type — pass --force to proceed or report the shape'
          process.exitCode = 1
          emitJson()
          return
        }

        const transform = await runTransform({
          rootDir: resolved.dir,
          detect: detection,
          dryRun: options.dryRun === true,
        })
        json.transform = transform

        if (!jsonMode) {
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

          // Preview only the first few files to avoid flooding the
          // terminal on large repos.
          if (options.dryRun === true && transform.changedFiles.length > 0) {
            const previewCount = Math.min(transform.changedFiles.length, 3)
            for (let i = 0; i < previewCount; i++) {
              const { path: rel, after } = transform.changedFiles[i]
              const truncated =
                after.length > 1200 ? after.slice(0, 1200) + '\n…' : after
              note(truncated, `preview: ${rel}`)
            }
            if (transform.changedFiles.length > previewCount) {
              note(
                `${transform.changedFiles.length - previewCount} more file(s) would change — re-run without --dry-run to apply.`,
                'preview (truncated)',
              )
            }
          }
        }

        // --- Dry-run terminates here. Per P2.4 spec DoD:
        //     "--dry-run never touches the GitHub API".
        if (options.dryRun === true) {
          if (!jsonMode) {
            outro(
              kleur.yellow(
                'dry-run complete — re-run without --dry-run to write changes and update package.json.',
              ),
            )
          }
          json.status = 'dry-run-complete'
          process.exitCode = 0
          emitJson()
          return
        }

        // --- Apply path. Zero changes = nothing to PR/patch either.
        if (transform.changedFiles.length === 0) {
          if (!jsonMode) {
            outro(
              kleur.dim(
                'no files changed (already wrapped or nothing matched the codemod).',
              ),
            )
          }
          json.status = 'no-changes'
          process.exitCode = 0
          emitJson()
          return
        }

        if (!options.pr) {
          if (!jsonMode) {
            outro(
              kleur.green(
                `wrapped ${transform.changedFiles.length} file(s) — skipped PR per --no-pr. Next: \`npm install\` + set ${transform.envVarsRequired.join(', ')}.`,
              ),
            )
          }
          json.status = 'skipped-pr'
          process.exitCode = 0
          emitJson()
          return
        }

        const token = options.token ?? process.env.GITHUB_TOKEN
        const repoInfo = await deriveRepoInfo({
          github: options.github ?? githubFromSource,
          positionalSource: source,
          localDir: resolved.dir,
        })

        if (!token || !repoInfo) {
          const patchContent = generatePatch(transform.changedFiles)
          const patchPath = path.join(process.cwd(), 'settlegrid-add.patch')
          await fsp.writeFile(patchPath, patchContent, 'utf-8')
          const reason = !token
            ? 'no GITHUB_TOKEN set (pass --token or export GITHUB_TOKEN)'
            : 'no GitHub repo info (pass --github or run from a repo with an origin remote)'
          if (!jsonMode) {
            outro(
              kleur.yellow(
                `${reason} — wrote patch to ${patchPath}. Apply with \`git apply\` after reviewing.`,
              ),
            )
          }
          json.status = 'patch-file-written'
          json.patchFile = patchPath
          process.exitCode = 0
          emitJson()
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
          if (!jsonMode) {
            outro(
              kleur.green(
                `opened PR ${pr.url}${pr.forkUsed ? kleur.dim(' (via fork)') : ''}`,
              ),
            )
          }
          json.status = 'pr-opened'
          json.pr = pr
          process.exitCode = 0
          emitJson()
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          if (!jsonMode) {
            outro(kleur.red(`PR creation failed: ${message}`))
          }
          json.status = 'pr-failed'
          json.error = message
          process.exitCode = 1
          emitJson()
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        if (!jsonMode) {
          outro(kleur.red(`settlegrid add failed: ${message}`))
        }
        json.status = 'error'
        json.error = message
        process.exitCode = 1
        emitJson()
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
