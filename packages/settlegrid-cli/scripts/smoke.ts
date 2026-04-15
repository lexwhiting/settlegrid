#!/usr/bin/env tsx
/**
 * P2.5 smoke-test driver — runs the built `settlegrid` binary against
 * a list of pinned real-world MCP server repos and asserts that
 * detection + transformation meet the expectations in
 * `smoke-targets.json`.
 *
 * Deliberately kept out of the default `npm test` pipeline — it's
 * network-bound (fetches each target via giget) and should only run
 * on demand:
 *
 *   cd packages/settlegrid-cli
 *   npm run build       # ensure dist/index.js is fresh
 *   npm run smoke       # or `tsx scripts/smoke.ts`
 *
 * Per-target exit codes:
 *   - All targets pass             → exit 0, stdout has a summary table
 *   - Any target fails an assertion → exit 1, stderr has a diff-style
 *                                     report for each failure
 *   - Network / clone failure       → exit 1 with the underlying error
 *
 * Assertions per target (per P2.5 spec):
 *   1. detect.type         === expectedType
 *   2. detect.language     === expectedLanguage
 *   3. changedFiles.length >= expectedMinChangedFiles
 *   4. transform.addedDependencies["@settlegrid/mcp"] is set
 *   5. No file inside the target dir was MUTATED by the dry-run
 *      (stat mtime check — dry-run must leave the tree untouched)
 */
import { spawnSync } from 'node:child_process'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadTemplate } from 'giget'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SmokeTarget {
  name: string
  github: string
  subdir?: string
  commit: string
  expectedType: 'mcp-server' | 'langchain-tool' | 'rest-api'
  expectedLanguage: 'ts' | 'js' | 'py' | 'unknown'
  expectedMinChangedFiles: number
  notes?: string
}

interface SmokeTargetsFile {
  targets: SmokeTarget[]
}

/**
 * Subset of the --json output from `settlegrid add`. Intentionally
 * loose-typed on the nested detect/transform structures — we assert
 * on field existence + primitive equality, not structural identity.
 */
interface CliJsonResult {
  status: string
  mode: string
  resolvedDir: string | null
  detect: {
    type: string
    language: string
    confidence: number
    entryPoints: string[]
    reasons: string[]
  } | null
  transform: {
    changedFiles: Array<{ path: string; before: string; after: string }>
    skipped: Array<{ path: string; reason: string }>
    addedDependencies: Record<string, string>
    envVarsRequired: string[]
  } | null
  error: string | null
}

interface TargetResult {
  name: string
  passed: boolean
  duration_ms: number
  error?: string
  cliOutput?: CliJsonResult
}

// ─── Paths ──────────────────────────────────────────────────────────────────

const here = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(here, '..')
const targetsFile = path.join(here, 'smoke-targets.json')
const distEntry = path.join(packageRoot, 'dist', 'index.js')

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and record each file's size + mtime
 * so we can diff before/after a dry-run and prove no mutation.
 */
async function snapshotTree(
  rootDir: string,
): Promise<Map<string, { size: number; mtimeMs: number }>> {
  const snapshot = new Map<string, { size: number; mtimeMs: number }>()
  async function walk(dir: string): Promise<void> {
    let entries: import('node:fs').Dirent[]
    try {
      entries = await fsp.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name)
      // Skip .git to avoid recording git internals (huge, unrelated,
      // and not something our codemod would ever touch).
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        const stat = await fsp.stat(full)
        snapshot.set(
          path.relative(rootDir, full),
          { size: stat.size, mtimeMs: stat.mtimeMs },
        )
      }
    }
  }
  await walk(rootDir)
  return snapshot
}

function compareSnapshots(
  before: Map<string, { size: number; mtimeMs: number }>,
  after: Map<string, { size: number; mtimeMs: number }>,
): string[] {
  const mutations: string[] = []
  for (const [rel, beforeStat] of before) {
    const afterStat = after.get(rel)
    if (!afterStat) {
      mutations.push(`deleted: ${rel}`)
      continue
    }
    if (afterStat.size !== beforeStat.size) {
      mutations.push(
        `size changed: ${rel} (${beforeStat.size} → ${afterStat.size})`,
      )
    }
    if (afterStat.mtimeMs !== beforeStat.mtimeMs) {
      mutations.push(
        `mtime changed: ${rel} (dry-run must not touch files)`,
      )
    }
  }
  for (const rel of after.keys()) {
    if (!before.has(rel)) {
      mutations.push(`created: ${rel}`)
    }
  }
  return mutations
}

async function withTmpDir<T>(
  prefix: string,
  fn: (dir: string) => Promise<T>,
): Promise<T> {
  const dir = await fsp.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    return await fn(dir)
  } finally {
    await fsp.rm(dir, { recursive: true, force: true })
  }
}

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runTarget(target: SmokeTarget): Promise<TargetResult> {
  const start = Date.now()
  try {
    return await withTmpDir(`settlegrid-smoke-${target.name}-`, async (dir) => {
      // 1. Fetch the repo at the pinned commit via giget.
      //    giget's shorthand: `github:owner/repo#<ref>`, where <ref>
      //    can be a branch or a commit SHA.
      const source = `github:${target.github}#${target.commit}`
      try {
        await downloadTemplate(source, { dir, force: true })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          name: target.name,
          passed: false,
          duration_ms: Date.now() - start,
          error: `giget fetch failed for ${source}: ${msg}`,
        }
      }

      // 2. Resolve the target directory (monorepo subdir or repo root).
      const targetDir = target.subdir
        ? path.join(dir, target.subdir)
        : dir
      try {
        const stat = await fsp.stat(targetDir)
        if (!stat.isDirectory()) {
          throw new Error(`${targetDir} is not a directory`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          name: target.name,
          passed: false,
          duration_ms: Date.now() - start,
          error: `subdir not found: ${target.subdir} (${msg})`,
        }
      }

      // 3. Snapshot the tree so we can detect any mutation after
      //    the dry-run CLI invocation.
      const before = await snapshotTree(targetDir)

      // 4. Spawn the built CLI with --dry-run --no-pr --json.
      //    NO_COLOR pinned so terminal control codes don't bleed
      //    into the JSON line.
      const result = spawnSync(
        'node',
        [
          distEntry,
          'add',
          '--path',
          targetDir,
          '--dry-run',
          '--no-pr',
          '--json',
        ],
        {
          encoding: 'utf-8',
          env: {
            ...process.env,
            NO_COLOR: '1',
            FORCE_COLOR: '0',
            // Explicitly clear GITHUB_TOKEN for the smoke run — we're
            // dry-run + --no-pr so it's never consulted, but pinning
            // it to empty ensures no accidental network call.
            GITHUB_TOKEN: '',
          },
        },
      )

      if (result.status !== 0) {
        return {
          name: target.name,
          passed: false,
          duration_ms: Date.now() - start,
          error:
            `CLI exit code ${result.status ?? 'null'}.\n` +
            `stdout: ${result.stdout?.slice(0, 500) ?? ''}\n` +
            `stderr: ${result.stderr?.slice(0, 500) ?? ''}`,
        }
      }

      // 5. Parse the JSON line from stdout. The CLI prints ONE line
      //    of JSON with --json; any other lines (empty, dim text
      //    from clack that leaked through, etc.) are stripped.
      let cliOutput: CliJsonResult
      try {
        const jsonLine = result.stdout
          .split('\n')
          .reverse()
          .find((line) => line.trim().startsWith('{'))
        if (!jsonLine) throw new Error('no JSON line in CLI stdout')
        cliOutput = JSON.parse(jsonLine) as CliJsonResult
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return {
          name: target.name,
          passed: false,
          duration_ms: Date.now() - start,
          error: `failed to parse CLI JSON output: ${msg}\nstdout: ${result.stdout.slice(0, 500)}`,
        }
      }

      // 6. Assertions per spec.
      const failures: string[] = []
      if (cliOutput.status !== 'dry-run-complete') {
        failures.push(
          `status expected 'dry-run-complete', got '${cliOutput.status}'`,
        )
      }
      if (!cliOutput.detect) {
        failures.push('detect result missing')
      } else {
        if (cliOutput.detect.type !== target.expectedType) {
          failures.push(
            `detect.type expected '${target.expectedType}', got '${cliOutput.detect.type}'`,
          )
        }
        if (cliOutput.detect.language !== target.expectedLanguage) {
          failures.push(
            `detect.language expected '${target.expectedLanguage}', got '${cliOutput.detect.language}'`,
          )
        }
      }
      if (!cliOutput.transform) {
        failures.push('transform result missing')
      } else {
        if (cliOutput.transform.changedFiles.length < target.expectedMinChangedFiles) {
          failures.push(
            `changedFiles.length expected >= ${target.expectedMinChangedFiles}, got ${cliOutput.transform.changedFiles.length}`,
          )
        }
        if (!cliOutput.transform.addedDependencies['@settlegrid/mcp']) {
          failures.push(
            `addedDependencies['@settlegrid/mcp'] missing (got keys: ${Object.keys(cliOutput.transform.addedDependencies).join(', ') || '(none)'})`,
          )
        }
      }

      // 7. Verify the dry-run didn't mutate any file under targetDir.
      const after = await snapshotTree(targetDir)
      const mutations = compareSnapshots(before, after)
      if (mutations.length > 0) {
        failures.push(
          `dry-run mutated ${mutations.length} file(s): ${mutations.slice(0, 3).join('; ')}`,
        )
      }

      if (failures.length > 0) {
        return {
          name: target.name,
          passed: false,
          duration_ms: Date.now() - start,
          error: failures.join('\n  · '),
          cliOutput,
        }
      }

      return {
        name: target.name,
        passed: true,
        duration_ms: Date.now() - start,
        cliOutput,
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return {
      name: target.name,
      passed: false,
      duration_ms: Date.now() - start,
      error: `unexpected error: ${msg}`,
    }
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<number> {
  // Sanity: the built binary must exist. We deliberately do NOT
  // trigger a build from here — the user is expected to have run
  // `npm run build` beforehand, and the message tells them so.
  try {
    await fsp.access(distEntry)
  } catch {
    process.stderr.write(
      `smoke: built binary not found at ${distEntry}\n` +
      `       run \`npm run build\` first (or \`npm run build && npm run smoke\`)\n`,
    )
    return 1
  }

  // Load the targets list.
  let targets: SmokeTarget[]
  try {
    const raw = await fsp.readFile(targetsFile, 'utf-8')
    const parsed = JSON.parse(raw) as SmokeTargetsFile
    if (!Array.isArray(parsed.targets) || parsed.targets.length === 0) {
      throw new Error('targets array is empty')
    }
    targets = parsed.targets
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    process.stderr.write(`smoke: failed to load targets file: ${msg}\n`)
    return 1
  }

  process.stdout.write(
    `settlegrid add smoke — ${targets.length} target(s)\n\n`,
  )

  const results: TargetResult[] = []
  for (const target of targets) {
    process.stdout.write(`▶ ${target.name} (${target.github}${target.subdir ? '#' + target.subdir : ''})\n`)
    const result = await runTarget(target)
    results.push(result)
    if (result.passed) {
      const cf = result.cliOutput?.transform?.changedFiles.length ?? 0
      process.stdout.write(
        `  ✓ PASS (${result.duration_ms}ms) — ${cf} file(s) would change\n`,
      )
    } else {
      process.stdout.write(`  ✗ FAIL (${result.duration_ms}ms)\n`)
      process.stdout.write(`    · ${result.error ?? 'unknown error'}\n`)
    }
  }

  const passed = results.filter((r) => r.passed).length
  const failed = results.filter((r) => !r.passed).length
  process.stdout.write(
    `\nsummary: ${passed} passed · ${failed} failed · ${results.length} total\n`,
  )

  if (failed > 0) {
    process.stdout.write('\nfailed targets:\n')
    for (const r of results.filter((x) => !x.passed)) {
      process.stdout.write(`  ${r.name}:\n    ${r.error ?? 'unknown'}\n`)
    }
    return 1
  }
  return 0
}

main()
  .then((code) => {
    process.exit(code)
  })
  .catch((err) => {
    const msg = err instanceof Error ? err.stack ?? err.message : String(err)
    process.stderr.write(`smoke: unhandled error: ${msg}\n`)
    process.exit(1)
  })
