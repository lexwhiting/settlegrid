import * as fsp from 'node:fs/promises'
import * as path from 'node:path'
import fg from 'fast-glob'

export type RepoType = 'mcp-server' | 'langchain-tool' | 'rest-api' | 'unknown'

export interface DetectResult {
  type: RepoType
  confidence: number
  language: 'ts' | 'js' | 'py' | 'unknown'
  entryPoints: string[]
  reasons: string[]
}

// Per P2.2 spec: scan caps so detection stays bounded + side-effect-free.
const MAX_SCAN_FILES = 500
const MAX_FILE_BYTES = 5 * 1024 * 1024
const SCAN_TIMEOUT_MS = 10_000

const IGNORE_GLOBS = [
  '**/node_modules/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.git/**',
]

// Shared fast-glob base options — consistent behaviour across every scan
// (no symlink traversal, capped depth, ignore generated dirs).
const GLOB_BASE = {
  onlyFiles: true,
  ignore: IGNORE_GLOBS,
  followSymbolicLinks: false,
  deep: 5,
} as const

interface Pkg {
  name?: string
  version?: string
  type?: string
  main?: string
  module?: string
  exports?: unknown
  bin?: string | Record<string, string>
  dependencies?: unknown
}

async function readPackageJson(rootDir: string): Promise<Pkg | null> {
  try {
    const raw = await fsp.readFile(path.join(rootDir, 'package.json'), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    // JSON.parse returns arrays as objects too; reject them explicitly so a
    // malformed `package.json` of shape `[]` is treated like no manifest.
    if (
      parsed &&
      typeof parsed === 'object' &&
      !Array.isArray(parsed)
    ) {
      return parsed as Pkg
    }
    return null
  } catch {
    return null
  }
}

/**
 * Per P2.2 spec: detection rules check `package.json.dependencies`. Returns
 * a plain object or {} — if `dependencies` is malformed (string, array,
 * number), return {} so downstream `'x' in deps` can't throw TypeError.
 */
function runtimeDeps(pkg: Pkg | null): Record<string, string> {
  const deps = pkg?.dependencies
  if (deps && typeof deps === 'object' && !Array.isArray(deps)) {
    return deps as Record<string, string>
  }
  return {}
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

/**
 * True when `abs` resolves to a path inside `rootAbs` (either rootAbs itself
 * or a descendant). Used to block path-traversal entries in package.json
 * fields like `main: "../../etc/passwd"`.
 */
function isInside(rootAbs: string, abs: string): boolean {
  const rel = path.relative(rootAbs, abs)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/**
 * Per P2.2 spec: language = py when pyproject.toml + .py files present;
 * ts when `package.json.type === "module"` AND .ts files present; else js.
 * If there's no package.json and no source files at all, return 'unknown'.
 */
async function inferLanguage(
  rootDir: string,
  pkg: Pkg | null,
): Promise<DetectResult['language']> {
  try {
    const hasPyproject = await exists(path.join(rootDir, 'pyproject.toml'))
    if (hasPyproject) {
      const pyFiles = await fg('**/*.py', { cwd: rootDir, ...GLOB_BASE })
      if (pyFiles.length > 0) return 'py'
    }

    const isEsModule = pkg?.type === 'module'
    if (isEsModule) {
      const tsFiles = await fg('**/*.{ts,tsx}', { cwd: rootDir, ...GLOB_BASE })
      if (tsFiles.length > 0) return 'ts'
    }

    // Fall through to js unless the directory is truly empty of source
    // files and has no package.json — in which case the repo is unknown.
    const anyJsFamily = await fg('**/*.{js,jsx,mjs,cjs,ts,tsx}', {
      cwd: rootDir,
      ...GLOB_BASE,
    })
    if (anyJsFamily.length > 0) return 'js'
    if (pkg) return 'js'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

/**
 * Per P2.2 spec: read `main`, `module`, `exports["."].default`, and any
 * `bin` values. Dedupe and return existing-on-disk paths only — and only
 * paths that resolve INSIDE rootDir, so a hostile package.json can't
 * leak arbitrary filesystem locations as "entry points".
 */
async function listEntryPoints(
  rootDir: string,
  pkg: Pkg | null,
): Promise<string[]> {
  if (!pkg) return []
  const candidates: string[] = []

  if (typeof pkg.main === 'string') candidates.push(pkg.main)
  if (typeof pkg.module === 'string') candidates.push(pkg.module)

  // Only the exact `exports["."].default` object-form path is in scope.
  if (pkg.exports && typeof pkg.exports === 'object' && !Array.isArray(pkg.exports)) {
    const exp = pkg.exports as Record<string, unknown>
    const dot = exp['.']
    if (dot && typeof dot === 'object' && !Array.isArray(dot)) {
      const def = (dot as Record<string, unknown>)['default']
      if (typeof def === 'string') candidates.push(def)
    }
  }

  if (typeof pkg.bin === 'string') {
    candidates.push(pkg.bin)
  } else if (pkg.bin && typeof pkg.bin === 'object' && !Array.isArray(pkg.bin)) {
    for (const v of Object.values(pkg.bin)) {
      if (typeof v === 'string') candidates.push(v)
    }
  }

  const rootAbs = path.resolve(rootDir)
  const unique = Array.from(new Set(candidates))
  const existing: string[] = []
  for (const rel of unique) {
    const abs = path.resolve(rootAbs, rel)
    if (!isInside(rootAbs, abs)) continue
    if (!(await exists(abs))) continue
    existing.push(rel)
  }
  return existing
}

interface ScanHit {
  matched: boolean
  file?: string
  snippet?: string
  captured?: string
}

/**
 * Scan JS/TS source files under rootDir for any of the given regexes.
 * Caps enforced via MAX_SCAN_FILES / MAX_FILE_BYTES / SCAN_TIMEOUT_MS so
 * a hostile or pathologically large repo can't hang detection.
 *
 * Symlink-pointed files and non-regular files (sockets, FIFOs, block
 * devices) are skipped: fast-glob is configured not to traverse into
 * symlinked dirs, and the per-file `stat.isFile()` check rejects symlink
 * files that would otherwise have been opened via their target.
 *
 * Repo files are read as text ONLY — never required, imported, spawned,
 * or otherwise executed.
 */
async function scanSourcesFor(
  rootDir: string,
  patterns: RegExp[],
): Promise<ScanHit> {
  const deadline = Date.now() + SCAN_TIMEOUT_MS
  let files: string[]
  try {
    files = await fg(['**/*.{ts,tsx,js,jsx,mjs,cjs}'], {
      cwd: rootDir,
      ...GLOB_BASE,
      absolute: false,
    })
  } catch {
    return { matched: false }
  }

  const capped = files.slice(0, MAX_SCAN_FILES)
  for (const rel of capped) {
    if (Date.now() > deadline) break
    const abs = path.join(rootDir, rel)
    try {
      // lstat lets us identify symlinks explicitly; even though fast-glob
      // is configured not to traverse symlinked DIRS, symlink FILES in the
      // scanned tree still show up and would be read through via their
      // target if we used `stat`. Reject non-regular-file entries outright.
      const stat = await fsp.lstat(abs)
      if (!stat.isFile()) continue
      if (stat.size > MAX_FILE_BYTES) continue
      const content = await fsp.readFile(abs, 'utf-8')
      for (const pattern of patterns) {
        const m = content.match(pattern)
        if (m) {
          return {
            matched: true,
            file: rel,
            snippet: m[0],
            captured: m[1],
          }
        }
      }
    } catch {
      // unreadable files are skipped, not fatal
    }
  }
  return { matched: false }
}

export async function detectRepoType(rootDir: string): Promise<DetectResult> {
  // Normalise once so every downstream fs / glob call sees the same base,
  // and so callers that pass relative paths get cwd-independent results.
  const absRoot = path.resolve(rootDir)

  const pkg = await readPackageJson(absRoot)
  const deps = runtimeDeps(pkg)
  const [language, entryPoints] = await Promise.all([
    inferLanguage(absRoot, pkg),
    listEntryPoints(absRoot, pkg),
  ])
  const reasons: string[] = []

  // Rule 1 — MCP server (confidence 0.95)
  if ('@modelcontextprotocol/sdk' in deps) {
    reasons.push(
      'package.json dependencies declare @modelcontextprotocol/sdk',
    )
    return {
      type: 'mcp-server',
      confidence: 0.95,
      language,
      entryPoints,
      reasons,
    }
  }
  const mcpImport = await scanSourcesFor(absRoot, [
    /from\s+['"]@modelcontextprotocol\/sdk(?:\/[^'"]*)?['"]/,
    /require\s*\(\s*['"]@modelcontextprotocol\/sdk(?:\/[^'"]*)?['"]\s*\)/,
  ])
  if (mcpImport.matched) {
    reasons.push(
      `source file ${mcpImport.file} imports @modelcontextprotocol/sdk`,
    )
    return {
      type: 'mcp-server',
      confidence: 0.95,
      language,
      entryPoints,
      reasons,
    }
  }

  // Rule 2 — LangChain tool (confidence 0.9)
  if ('@langchain/core' in deps || 'langchain' in deps) {
    const extendsTool = await scanSourcesFor(absRoot, [
      /class\s+\w+\s+extends\s+(StructuredTool|DynamicStructuredTool|Tool)\b/,
    ])
    if (extendsTool.matched) {
      const dep = '@langchain/core' in deps ? '@langchain/core' : 'langchain'
      reasons.push(`package.json dependencies declare ${dep}`)
      reasons.push(
        `source file ${extendsTool.file} extends ${extendsTool.captured ?? 'Tool'}`,
      )
      return {
        type: 'langchain-tool',
        confidence: 0.9,
        language,
        entryPoints,
        reasons,
      }
    }
  }

  // Rule 3 — REST API (confidence 0.8)
  const REST_FRAMEWORKS = [
    'express',
    'fastify',
    'hono',
    'koa',
    '@hono/node-server',
  ]
  const matchedRest = REST_FRAMEWORKS.find((d) => d in deps)
  if (matchedRest) {
    reasons.push(`package.json dependencies declare ${matchedRest}`)
    return {
      type: 'rest-api',
      confidence: 0.8,
      language,
      entryPoints,
      reasons,
    }
  }

  // Rule 4 — unknown (confidence 0)
  reasons.push(
    'no MCP SDK, LangChain tool, or REST framework signal detected in package.json dependencies or source files',
  )
  return {
    type: 'unknown',
    confidence: 0,
    language,
    entryPoints,
    reasons,
  }
}
