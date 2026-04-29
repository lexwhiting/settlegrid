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
 * Assertions per target (per P2.5 spec + hostile-review additions):
 *   1. detect.type         === expectedType
 *   2. detect.language     === expectedLanguage
 *   3. changedFiles.length >= expectedMinChangedFiles
 *   4. transform.addedDependencies["@settlegrid/mcp"] is set
 *   5. First changedFile.after imports from '@settlegrid/mcp'
 *      (regression guard against a codemod that emits garbled source
 *      but keeps the file-count + deps metadata correct)
 *   6. No file in the sandbox was MUTATED by the dry-run (full-tmp
 *      mtime/size diff against a pre-spawn snapshot)
 *   7. No file was LEAKED into the sandboxed spawn cwd (separate
 *      diff using immediate-children list; isolated from os.tmpdir()
 *      noise so other processes on the host can't false-positive us)
 */
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import * as fsp from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { downloadTemplate } from 'giget'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SmokeTarget {
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

// ─── Validation ─────────────────────────────────────────────────────────────

/**
 * Shape-check a single target entry from smoke-targets.json and throw
 * a readable error that pinpoints the offending index + field. Without
 * this, a typo in the JSON would cast through as `undefined` and
 * produce opaque assertion failures later in the run.
 */
export function validateTarget(raw: unknown, idx: number): SmokeTarget {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error(`target[${idx}] must be an object`)
  }
  const obj = raw as Record<string, unknown>

  const stringField = (key: string): string => {
    const v = obj[key]
    if (typeof v !== 'string' || v.length === 0) {
      throw new Error(`target[${idx}] missing or empty string field: ${key}`)
    }
    return v
  }

  const name = stringField('name')
  const github = stringField('github')
  const commit = stringField('commit')
  const expectedType = stringField('expectedType')
  const expectedLanguage = stringField('expectedLanguage')

  if (!['mcp-server', 'langchain-tool', 'rest-api'].includes(expectedType)) {
    throw new Error(
      `target[${idx}] (${name}) invalid expectedType: ${expectedType}`,
    )
  }
  if (!['ts', 'js', 'py', 'unknown'].includes(expectedLanguage)) {
    throw new Error(
      `target[${idx}] (${name}) invalid expectedLanguage: ${expectedLanguage}`,
    )
  }

  const min = obj.expectedMinChangedFiles
  if (typeof min !== 'number' || !Number.isInteger(min) || min < 0) {
    throw new Error(
      `target[${idx}] (${name}) expectedMinChangedFiles must be a non-negative integer`,
    )
  }

  if (obj.subdir !== undefined && typeof obj.subdir !== 'string') {
    throw new Error(
      `target[${idx}] (${name}) subdir must be a string when provided`,
    )
  }
  if (obj.notes !== undefined && typeof obj.notes !== 'string') {
    throw new Error(
      `target[${idx}] (${name}) notes must be a string when provided`,
    )
  }

  return {
    name,
    github,
    subdir: obj.subdir as string | undefined,
    commit,
    expectedType: expectedType as SmokeTarget['expectedType'],
    expectedLanguage: expectedLanguage as SmokeTarget['expectedLanguage'],
    expectedMinChangedFiles: min,
    notes: obj.notes as string | undefined,
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

/**
 * Recursively walk a directory and record each file's size + mtime
 * so we can diff before/after a dry-run and prove no mutation.
 */
export async function snapshotTree(
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
      // Skip .git / node_modules to avoid recording giget internals
      // (huge, unrelated, and not something our codemod would ever
      // touch).
      if (entry.name === '.git' || entry.name === 'node_modules') continue
      if (entry.isDirectory()) {
        await walk(full)
      } else if (entry.isFile()) {
        try {
          const stat = await fsp.stat(full)
          snapshot.set(
            path.relative(rootDir, full),
            { size: stat.size, mtimeMs: stat.mtimeMs },
          )
        } catch {
          // File disappeared between readdir and stat — unlikely in
          // a controlled tmpdir but we skip gracefully rather than
          // crashing the whole smoke run.
        }
      }
    }
  }
  await walk(rootDir)
  return snapshot
}

export function compareSnapshots(
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
    if (
      afterStat.size !== beforeStat.size ||
      afterStat.mtimeMs !== beforeStat.mtimeMs
    ) {
      // Emit ONE entry per mutated file even if both size and mtime
      // shifted — the previous two-entry form cluttered the summary
      // and didn't add information.
      mutations.push(
        `mutated: ${rel} (size ${beforeStat.size}→${afterStat.size}, mtime ${beforeStat.mtimeMs}→${afterStat.mtimeMs})`,
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

/**
 * List immediate children (files + directories) of `dir`, or return
 * an empty array if the directory doesn't exist / isn't readable.
 * Used to diff the spawn cwd before/after a smoke run so any leaked
 * file (a rogue `settlegrid-add.patch`, a fork tmpdir, etc.) surfaces
 * as a test failure rather than silently piling up.
 */
export async function listDirEntries(dir: string): Promise<string[]> {
  try {
    const entries = await fsp.readdir(dir)
    return entries.sort()
  } catch {
    return []
  }
}

/**
 * Allocate a per-target sandbox layout and clean it up via a
 * deterministic try/finally. Layout:
 *
 *   <os.tmpdir()>/settlegrid-smoke-<name>-<random>/
 *     ├── fetch/          ← giget downloadTemplate target
 *     └── cwd/            ← spawn cwd for the CLI invocation
 *
 * The `fetch/` subdir is the only place giget writes, and the `cwd/`
 * subdir is empty at spawn time so any file the CLI drops into
 * `process.cwd()` is detectable via a bare listDirEntries diff.
 * Neither subdir is `os.tmpdir()` itself, so background noise from
 * other processes can't false-positive the cwd leak check.
 */
interface Sandbox {
  tmpParent: string
  fetchDir: string
  cwdDir: string
}
async function withSandbox<T>(
  prefix: string,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<T> {
  const tmpParent = await fsp.mkdtemp(path.join(os.tmpdir(), prefix))
  try {
    const fetchDir = path.join(tmpParent, 'fetch')
    const cwdDir = path.join(tmpParent, 'cwd')
    await fsp.mkdir(fetchDir, { recursive: true })
    await fsp.mkdir(cwdDir, { recursive: true })
    return await fn({ tmpParent, fetchDir, cwdDir })
  } finally {
    await fsp.rm(tmpParent, { recursive: true, force: true })
  }
}

// ─── Runner ─────────────────────────────────────────────────────────────────

async function runTarget(target: SmokeTarget): Promise<TargetResult> {
  const start = Date.now()
  try {
    return await withSandbox(
      `settlegrid-smoke-${target.name}-`,
      async ({ fetchDir, cwdDir }) => {
        // 1. Fetch the repo at the pinned commit via giget.
        //    giget's shorthand: `github:owner/repo#<ref>`, where <ref>
        //    can be a branch or a commit SHA.
        const source = `github:${target.github}#${target.commit}`
        try {
          await downloadTemplate(source, { dir: fetchDir, force: true })
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
          ? path.join(fetchDir, target.subdir)
          : fetchDir
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

        // 3. Snapshot the ENTIRE fetched tmp dir (not just the target
        //    subdir) so we can detect any mutation after the dry-run
        //    CLI invocation. Spec DoD: "No file outside tmp dir was
        //    touched" — broadening the scope to the full fetch tree
        //    catches a wider class of accidental writes than scanning
        //    only the subdir the CLI was pointed at. And the SPAWN
        //    CWD is a dedicated empty dir inside the sandbox, so any
        //    stray file the CLI drops into `process.cwd()` shows up
        //    as a single "created:" entry without background noise
        //    from other processes in `os.tmpdir()`.
        const before = await snapshotTree(fetchDir)
        const beforeCwd = await listDirEntries(cwdDir)

        // 4. Spawn the built CLI with --dry-run --no-pr --json.
        //    NO_COLOR pinned so terminal control codes don't bleed
        //    into the JSON line. `cwd` is pinned to the sandbox's
        //    cwdDir so any stray file the CLI writes to
        //    `process.cwd()` (e.g. a patch file leak) lands inside
        //    our sandbox and gets reaped by the outer rm.
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
            cwd: cwdDir,
            env: {
              ...process.env,
              NO_COLOR: '1',
              FORCE_COLOR: '0',
              // Explicitly clear GITHUB_TOKEN for the smoke run —
              // we're dry-run + --no-pr so it's never consulted, but
              // pinning it to empty ensures no accidental network
              // call if a test env has one set.
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

        // 6. Assertions per spec + hostile-review additions.
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
          if (
            cliOutput.transform.changedFiles.length <
            target.expectedMinChangedFiles
          ) {
            failures.push(
              `changedFiles.length expected >= ${target.expectedMinChangedFiles}, got ${cliOutput.transform.changedFiles.length}`,
            )
          }
          if (!cliOutput.transform.addedDependencies['@settlegrid/mcp']) {
            failures.push(
              `addedDependencies['@settlegrid/mcp'] missing (got keys: ${
                Object.keys(cliOutput.transform.addedDependencies).join(', ') ||
                '(none)'
              })`,
            )
          }
          // Regression guard (hostile-review fix): the FIRST changed
          // file's `after` content must actually contain the
          // @settlegrid/mcp import. A codemod that emits garbled
          // source while preserving file counts + deps would
          // otherwise pass the preceding assertions silently.
          if (cliOutput.transform.changedFiles.length > 0) {
            const firstFile = cliOutput.transform.changedFiles[0]
            const hasSdkImport =
              firstFile.after.includes("from '@settlegrid/mcp'") ||
              firstFile.after.includes('from "@settlegrid/mcp"')
            if (!hasSdkImport) {
              failures.push(
                `first changed file (${firstFile.path}) does not import from @settlegrid/mcp (first 120 chars: ${firstFile.after.slice(0, 120)}…)`,
              )
            }
          }
        }

        // 7. Verify the dry-run didn't mutate any file under fetchDir.
        const after = await snapshotTree(fetchDir)
        const mutations = compareSnapshots(before, after)
        if (mutations.length > 0) {
          failures.push(
            `dry-run mutated ${mutations.length} file(s) under the sandbox fetch dir: ${mutations.slice(0, 3).join('; ')}`,
          )
        }
        // And verify the spawn cwd stayed empty — any leaked file
        // (a rogue `settlegrid-add.patch`, a fork tmpdir, a stray
        // log file) surfaces here.
        const afterCwd = await listDirEntries(cwdDir)
        const newCwdEntries = afterCwd.filter((e) => !beforeCwd.includes(e))
        if (newCwdEntries.length > 0) {
          failures.push(
            `dry-run leaked ${newCwdEntries.length} file(s) into the sandbox cwd: ${newCwdEntries.slice(0, 3).join(', ')}`,
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
      },
    )
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
        `       run \`npm run build\` first (or \`npm run test:smoke\`)\n`,
    )
    return 1
  }

  // Load + validate the targets list.
  let targets: SmokeTarget[]
  try {
    const raw = await fsp.readFile(targetsFile, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !('targets' in parsed) ||
      !Array.isArray((parsed as { targets: unknown }).targets)
    ) {
      throw new Error('smoke-targets.json must have a `targets` array')
    }
    const rawTargets = (parsed as { targets: unknown[] }).targets
    if (rawTargets.length === 0) {
      throw new Error('smoke-targets.json has no targets')
    }
    targets = rawTargets.map((t, i) => validateTarget(t, i))
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
    process.stdout.write(
      `▶ ${target.name} (${target.github}${target.subdir ? '#' + target.subdir : ''})\n`,
    )
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

/**
 * True only when this file is the Node entrypoint (i.e. invoked as
 * `tsx scripts/smoke.ts`). Returns false for vitest / in-process
 * imports of the helper exports above, so the test suite can pull
 * in `validateTarget` / `compareSnapshots` etc. without accidentally
 * kicking off a real smoke run that would fetch 3 repos from GitHub.
 */
function isMainEntry(): boolean {
  const argvEntry = process.argv[1]
  if (!argvEntry) return false
  try {
    const argvReal = realpathSync(argvEntry)
    const thisReal = realpathSync(fileURLToPath(import.meta.url))
    return argvReal === thisReal
  } catch {
    return false
  }
}

if (isMainEntry()) {
  main()
    .then((code) => {
      process.exit(code)
    })
    .catch((err) => {
      const msg = err instanceof Error ? err.stack ?? err.message : String(err)
      process.stderr.write(`smoke: unhandled error: ${msg}\n`)
      process.exit(1)
    })
}
