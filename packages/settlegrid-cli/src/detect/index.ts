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

interface Pkg {
  name?: string
  version?: string
  type?: string
  main?: string
  module?: string
  exports?: unknown
  bin?: string | Record<string, string>
  dependencies?: Record<string, string>
  devDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
}

async function readPackageJson(rootDir: string): Promise<Pkg | null> {
  try {
    const raw = await fsp.readFile(path.join(rootDir, 'package.json'), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') return parsed as Pkg
    return null
  } catch {
    return null
  }
}

function allDeps(pkg: Pkg | null): Record<string, string> {
  if (!pkg) return {}
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.peerDependencies ?? {}),
  }
}

async function exists(p: string): Promise<boolean> {
  try {
    await fsp.access(p)
    return true
  } catch {
    return false
  }
}

async function inferLanguage(
  rootDir: string,
  pkg: Pkg | null,
): Promise<DetectResult['language']> {
  const hasPyproject = await exists(path.join(rootDir, 'pyproject.toml'))
  try {
    if (hasPyproject) {
      const pyFiles = await fg('**/*.py', {
        cwd: rootDir,
        onlyFiles: true,
        ignore: IGNORE_GLOBS,
        deep: 5,
      })
      if (pyFiles.length > 0) return 'py'
    }
    const tsFiles = await fg('**/*.{ts,tsx}', {
      cwd: rootDir,
      onlyFiles: true,
      ignore: IGNORE_GLOBS,
      deep: 5,
    })
    if (tsFiles.length > 0) {
      // Spec: "type: module" + .ts files → ts. If .ts exists at all, prefer ts.
      return 'ts'
    }
    const jsFiles = await fg('**/*.{js,jsx,mjs,cjs}', {
      cwd: rootDir,
      onlyFiles: true,
      ignore: IGNORE_GLOBS,
      deep: 5,
    })
    if (jsFiles.length > 0) return 'js'
    // Language hints from package.json alone if no source files scanned yet.
    if (pkg) return 'js'
    return 'unknown'
  } catch {
    return 'unknown'
  }
}

async function listEntryPoints(
  rootDir: string,
  pkg: Pkg | null,
): Promise<string[]> {
  if (!pkg) return []
  const candidates: string[] = []

  if (typeof pkg.main === 'string') candidates.push(pkg.main)
  if (typeof pkg.module === 'string') candidates.push(pkg.module)

  if (pkg.exports && typeof pkg.exports === 'object') {
    const exp = pkg.exports as Record<string, unknown>
    const dot = exp['.']
    if (typeof dot === 'string') {
      candidates.push(dot)
    } else if (dot && typeof dot === 'object') {
      const dotObj = dot as Record<string, unknown>
      const def = dotObj['default']
      if (typeof def === 'string') candidates.push(def)
    }
  }

  if (typeof pkg.bin === 'string') {
    candidates.push(pkg.bin)
  } else if (pkg.bin && typeof pkg.bin === 'object') {
    for (const v of Object.values(pkg.bin)) {
      if (typeof v === 'string') candidates.push(v)
    }
  }

  const unique = Array.from(new Set(candidates))
  const existing: string[] = []
  for (const rel of unique) {
    if (await exists(path.join(rootDir, rel))) existing.push(rel)
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
 * Caps enforced via MAX_SCAN_FILES / MAX_FILE_BYTES / SCAN_TIMEOUT_MS so a
 * hostile or pathologically large repo can't hang detection.
 *
 * Repo files are read as text ONLY — never required, imported, or executed.
 */
async function scanSourcesFor(
  rootDir: string,
  patterns: RegExp[],
  capturePatternIndex?: number,
): Promise<ScanHit> {
  const deadline = Date.now() + SCAN_TIMEOUT_MS
  let files: string[]
  try {
    files = await fg(['**/*.{ts,tsx,js,jsx,mjs,cjs}'], {
      cwd: rootDir,
      onlyFiles: true,
      ignore: IGNORE_GLOBS,
      absolute: false,
      followSymbolicLinks: false,
    })
  } catch {
    return { matched: false }
  }

  const capped = files.slice(0, MAX_SCAN_FILES)
  for (const rel of capped) {
    if (Date.now() > deadline) break
    const abs = path.join(rootDir, rel)
    try {
      const stat = await fsp.stat(abs)
      if (stat.size > MAX_FILE_BYTES) continue
      const content = await fsp.readFile(abs, 'utf-8')
      for (let i = 0; i < patterns.length; i++) {
        const m = content.match(patterns[i])
        if (m) {
          const captured =
            capturePatternIndex !== undefined && i === capturePatternIndex
              ? m[1]
              : undefined
          return { matched: true, file: rel, snippet: m[0], captured: captured ?? m[1] }
        }
      }
    } catch {
      // unreadable files are skipped, not fatal
    }
  }
  return { matched: false }
}

export async function detectRepoType(rootDir: string): Promise<DetectResult> {
  const pkg = await readPackageJson(rootDir)
  const deps = allDeps(pkg)
  const [language, entryPoints] = await Promise.all([
    inferLanguage(rootDir, pkg),
    listEntryPoints(rootDir, pkg),
  ])
  const reasons: string[] = []

  // Rule 1 — MCP server (confidence 0.95)
  if ('@modelcontextprotocol/sdk' in deps) {
    reasons.push(
      'package.json declares @modelcontextprotocol/sdk as a dependency',
    )
    return {
      type: 'mcp-server',
      confidence: 0.95,
      language,
      entryPoints,
      reasons,
    }
  }
  const mcpImport = await scanSourcesFor(rootDir, [
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
    const extendsTool = await scanSourcesFor(
      rootDir,
      [/class\s+\w+\s+extends\s+(StructuredTool|DynamicStructuredTool|Tool)\b/],
      0,
    )
    if (extendsTool.matched) {
      const dep = '@langchain/core' in deps ? '@langchain/core' : 'langchain'
      reasons.push(`package.json declares ${dep} as a dependency`)
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
    reasons.push(`package.json declares ${matchedRest} as a dependency`)
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
    'no MCP SDK, LangChain tool, or REST framework signal detected in package.json or source files',
  )
  return {
    type: 'unknown',
    confidence: 0,
    language,
    entryPoints,
    reasons,
  }
}
