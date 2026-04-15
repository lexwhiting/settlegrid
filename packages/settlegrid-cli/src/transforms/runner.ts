import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'
import type { DetectResult, RepoType } from '../detect/index.js'
import { addMcpTransform } from './add-mcp.js'
import { addLangchainTransform } from './add-langchain.js'
import { addRestTransform } from './add-rest.js'

/**
 * Caret range matching the currently-published @settlegrid/mcp. P2.3
 * mutates the target repo's package.json to add this dep (without
 * running npm install).
 */
export const SETTLEGRID_MCP_RANGE = '^0.1.1'

// Cap for how many source files the runner will consider — bounded so
// pathologically large repos can't stall the add command. Mirrors the
// 500 cap used in the detection scanner.
const MAX_TRANSFORM_FILES = 500

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.git/**',
]

export interface TransformInput {
  rootDir: string
  detect: DetectResult
  dryRun: boolean
}

export interface TransformOutput {
  changedFiles: Array<{ path: string; before: string; after: string }>
  skipped: Array<{ path: string; reason: string }>
  addedDependencies: Record<string, string>
  envVarsRequired: string[]
}

export interface CodemodContext {
  filename: string
  toolSlug: string
}

export type Codemod = (source: string, ctx: CodemodContext) => string

/**
 * Detect whether a file has already been monetized so subsequent runs
 * are no-ops. Treats ANY import from `@settlegrid/mcp` or a subpath
 * (`@settlegrid/mcp/kernel`, `@settlegrid/mcp/rest`, …) OR any
 * `settlegrid.init(…)` call as sufficient evidence. String-level check
 * is intentionally cheap — the per-codemod sg.wrap idempotency guards
 * still protect against partial re-wraps within a file that uses the
 * import but hasn't been fully transformed.
 */
export function isAlreadyWrapped(source: string): boolean {
  return (
    /from\s+['"]@settlegrid\/mcp(?:\/[^'"]*)?['"]/.test(source) ||
    /settlegrid\s*\.\s*init\s*\(/.test(source)
  )
}

function selectCodemod(type: RepoType): Codemod | null {
  switch (type) {
    case 'mcp-server':
      return addMcpTransform
    case 'langchain-tool':
      return addLangchainTransform
    case 'rest-api':
      return addRestTransform
    default:
      return null
  }
}

async function deriveToolSlug(rootDir: string): Promise<string> {
  try {
    const raw = await fsp.readFile(path.join(rootDir, 'package.json'), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const pkg = parsed as { name?: unknown }
      if (typeof pkg.name === 'string' && pkg.name.length > 0) {
        // Strip scope prefix so `@acme/foo` → `foo`.
        const stripped = pkg.name.startsWith('@')
          ? pkg.name.split('/')[1] ?? pkg.name
          : pkg.name
        const slug = stripped
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
        if (slug) return slug
      }
    }
  } catch {
    // Fall through to the placeholder below.
  }
  return 'my-tool'
}

/**
 * Add `{ name: range }` to the target repo's `package.json` dependencies,
 * preserving the file's original indent style and trailing newline and
 * keeping `dependencies` keys alphabetically sorted so repeat runs
 * produce the same output (DoD: "deterministic").
 *
 * Returns true if the file was actually modified (i.e. the dep wasn't
 * already present). Missing / malformed package.json = no-op.
 */
export async function addPackageDependency(
  rootDir: string,
  name: string,
  range: string,
): Promise<boolean> {
  const pkgPath = path.join(rootDir, 'package.json')
  let raw: string
  try {
    raw = await fsp.readFile(pkgPath, 'utf-8')
  } catch {
    return false
  }
  let pkg: Record<string, unknown>
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return false
    }
    pkg = parsed as Record<string, unknown>
  } catch {
    return false
  }

  const existing =
    pkg.dependencies &&
    typeof pkg.dependencies === 'object' &&
    !Array.isArray(pkg.dependencies)
      ? { ...(pkg.dependencies as Record<string, string>) }
      : {}

  if (existing[name]) return false

  existing[name] = range

  // Deterministic alphabetical sort so the diff is stable across runs.
  const sorted: Record<string, string> = {}
  for (const key of Object.keys(existing).sort()) {
    sorted[key] = existing[key]
  }
  pkg.dependencies = sorted

  const indent = detectIndent(raw)
  const trailingNewline = raw.endsWith('\n') ? '\n' : ''
  await fsp.writeFile(
    pkgPath,
    JSON.stringify(pkg, null, indent) + trailingNewline,
    'utf-8',
  )
  return true
}

function detectIndent(raw: string): number | string {
  // Look at the first indented line to match the file's original style.
  const match = raw.match(/^([ \t]+)"/m)
  if (!match) return 2
  if (match[1].includes('\t')) return '\t'
  return match[1].length
}

/**
 * Main entry — dispatches to the per-type codemod, collects diffs,
 * writes results (unless dryRun), and mutates the target package.json
 * to add @settlegrid/mcp. Side-effect-free when dryRun is true.
 */
export async function runTransform(
  input: TransformInput,
): Promise<TransformOutput> {
  const absRoot = path.resolve(input.rootDir)
  const codemod = selectCodemod(input.detect.type)

  const changedFiles: TransformOutput['changedFiles'] = []
  const skipped: TransformOutput['skipped'] = []

  if (!codemod) {
    return {
      changedFiles,
      skipped,
      addedDependencies: {},
      envVarsRequired: ['SETTLEGRID_API_KEY'],
    }
  }

  const toolSlug = await deriveToolSlug(absRoot)

  // Enumerate + cap source files. Entry points from detect are implicitly
  // included because the glob covers all JS/TS family files.
  let files: string[]
  try {
    files = await fg(['**/*.{ts,tsx,js,jsx,mjs,cjs}'], {
      cwd: absRoot,
      onlyFiles: true,
      ignore: IGNORE_GLOBS,
      followSymbolicLinks: false,
      deep: 5,
    })
  } catch {
    files = []
  }
  const capped = files.slice(0, MAX_TRANSFORM_FILES)

  for (const rel of capped) {
    const abs = path.join(absRoot, rel)
    let before: string
    try {
      const stat = await fsp.lstat(abs)
      if (!stat.isFile()) continue
      before = await fsp.readFile(abs, 'utf-8')
    } catch {
      continue
    }

    if (isAlreadyWrapped(before)) {
      skipped.push({ path: rel, reason: 'already-wrapped' })
      continue
    }

    try {
      const after = codemod(before, { filename: rel, toolSlug })
      if (after === before) continue
      changedFiles.push({ path: rel, before, after })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ path: rel, reason: `transform error: ${msg}` })
    }
  }

  // Track which files actually landed on disk so the reported
  // `changedFiles` reflects real state. On write failures we move
  // the entry into `skipped` with a readable reason instead of
  // aborting mid-loop — otherwise one bad file (read-only, ENOSPC,
  // permissions) would leave the target repo half-wrapped with no
  // package.json update.
  const actuallyChanged: TransformOutput['changedFiles'] = []
  if (!input.dryRun) {
    for (const entry of changedFiles) {
      try {
        await fsp.writeFile(
          path.join(absRoot, entry.path),
          entry.after,
          'utf-8',
        )
        actuallyChanged.push(entry)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        skipped.push({ path: entry.path, reason: `write failed: ${msg}` })
      }
    }
    // package.json update is best-effort: if it fails (read-only, etc.)
    // we record the failure but still return the successful writes so
    // the user knows what landed.
    try {
      await addPackageDependency(
        absRoot,
        '@settlegrid/mcp',
        SETTLEGRID_MCP_RANGE,
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      skipped.push({ path: 'package.json', reason: `write failed: ${msg}` })
    }
  }

  return {
    changedFiles: input.dryRun ? changedFiles : actuallyChanged,
    skipped,
    addedDependencies: { '@settlegrid/mcp': SETTLEGRID_MCP_RANGE },
    envVarsRequired: ['SETTLEGRID_API_KEY'],
  }
}
