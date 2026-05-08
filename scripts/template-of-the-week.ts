/**
 * P5.4 — Template-of-the-Week pipeline.
 *
 * Weekly cron (Monday 09:00 UTC, see .github/workflows/template-of-the-week.yml):
 *   1. Read registry.json + history.
 *   2. Query PostHog for scaffold_success and template_detail_viewed
 *      counts per template slug over the last --days window.
 *   3. Score (apps/web/src/lib/totw/scoring.ts) and pick the winner.
 *   4. If no candidate (every score ≤ 0 or registry yields nothing):
 *      emit `{"status":"no_candidate"}` and exit 0. The workflow
 *      reads this and short-circuits — no Anthropic call, no PR.
 *   5. Otherwise: ask Claude for a 300-500 word draft using the
 *      prompt in apps/web/src/lib/totw/draft.ts (founder voice rules,
 *      no marketing speak), validate the result, write the body
 *      markdown file, splice imports + entry into the auto-generated
 *      registered.ts, append to history.json, emit
 *      `{"status":"drafted","slug":"...","date":"...","draftFile":"..."}`.
 *
 * Hard failure (env missing, API call fails, model output invalid)
 * exits non-zero so the workflow surfaces a red run.
 *
 * Usage:
 *   POSTHOG_PERSONAL_API_KEY=phx_... \
 *   POSTHOG_PROJECT_ID=12345 \
 *   ANTHROPIC_API_KEY=sk-ant-... \
 *   npx tsx scripts/template-of-the-week.ts [--days 7] [--dry-run] \
 *     [--output /tmp/totw-output.json] [--today YYYY-MM-DD]
 *
 * Flags:
 *   --days N        Lookback window for PostHog scoring. Default 7.
 *   --dry-run       Pick + draft but skip file writes (still emits output JSON).
 *   --output PATH   Where to write the machine-readable status JSON.
 *                   Default: /tmp/totw-output.json
 *   --today DATE    Override "now" (UTC). Useful for tests + replay.
 */

import Anthropic from '@anthropic-ai/sdk'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  type TotwScoringInput,
  pickWinner,
} from '../apps/web/src/lib/totw/scoring.js'
import {
  type TotwHistoryEntry,
  appendHistory,
  readHistory,
  recentlyFeaturedSlugs,
} from '../apps/web/src/lib/totw/history.js'
import {
  assertSafeSlug,
  buildDraftPrompt,
  countWords,
  formatDateUtc,
  makeDraftPaths,
  validateDraft,
} from '../apps/web/src/lib/totw/draft.js'

// ─── Constants ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')

const REGISTRY_PATH = join(REPO_ROOT, 'apps', 'web', 'public', 'registry.json')
const HISTORY_PATH = join(REPO_ROOT, 'docs', 'content', 'totw-history.json')
const REGISTERED_PATH = join(
  REPO_ROOT,
  'apps',
  'web',
  'src',
  'lib',
  'blog-bodies',
  'totw',
  'registered.ts',
)
const TOTW_BODIES_DIR = join(
  REPO_ROOT,
  'apps',
  'web',
  'src',
  'lib',
  'blog-bodies',
  'totw',
)
const DEFAULT_OUTPUT = '/tmp/totw-output.json'

const DEFAULT_HOST = 'https://us.i.posthog.com'
const POSTHOG_TIMEOUT_MS = 15_000

const ANTHROPIC_MODEL = 'claude-sonnet-4-6'
const ANTHROPIC_MAX_TOKENS = 1500

// ─── Types ──────────────────────────────────────────────────────────────────

interface CliArgs {
  days: number
  dryRun: boolean
  outputPath: string
  today: Date
}

interface RegistryTemplate {
  slug: string
  name: string
  description: string
  category: string
}

interface PostHogConfig {
  host: string
  apiKey: string
  projectId: string
}

interface OutputNoCandidate {
  status: 'no_candidate'
  reason: string
  scoredCount: number
  recentlyFeaturedCount: number
}

interface OutputDrafted {
  status: 'drafted'
  slug: string
  templateName: string
  date: string
  postSlug: string
  draftFile: string
  registryFile: string
  historyFile: string
  score: number
  scoreComponents: {
    scaffold: number
    view: number
    freshness: number
  }
  wordCount: number
  dryRun: boolean
  /**
   * Only present when dryRun=true. The output JSON is the only place
   * an operator can inspect the generated draft on a dry-run, since
   * no file gets written. Live runs omit this — the body is on disk
   * and would only bloat the JSON.
   */
  body?: string
}

type Output = OutputNoCandidate | OutputDrafted

// ─── CLI parsing ────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): CliArgs {
  const args = argv.slice(2)
  let days = 7
  let dryRun = false
  let outputPath = DEFAULT_OUTPUT
  let today = new Date()

  for (let i = 0; i < args.length; i += 1) {
    const a = args[i]
    if (a === '--days') {
      const v = args[i + 1]
      if (!v || v.startsWith('--')) {
        throw new Error('--days requires a positive integer argument')
      }
      const n = Number(v)
      if (!Number.isInteger(n) || n <= 0 || n > 90) {
        throw new Error(`--days must be 1..90 (got ${JSON.stringify(v)})`)
      }
      days = n
      i += 1
    } else if (a === '--dry-run') {
      dryRun = true
    } else if (a === '--output') {
      const v = args[i + 1]
      if (!v || v.startsWith('--')) {
        throw new Error('--output requires a path argument')
      }
      outputPath = v
      i += 1
    } else if (a === '--today') {
      const v = args[i + 1]
      if (!v || v.startsWith('--')) {
        throw new Error('--today requires a YYYY-MM-DD argument')
      }
      const parsed = Date.parse(`${v}T00:00:00Z`)
      if (!Number.isFinite(parsed)) {
        throw new Error(`--today must be YYYY-MM-DD (got ${JSON.stringify(v)})`)
      }
      today = new Date(parsed)
      i += 1
    } else {
      throw new Error(`Unknown argument ${JSON.stringify(a)}`)
    }
  }

  return { days, dryRun, outputPath, today }
}

// ─── Env ────────────────────────────────────────────────────────────────────

function readPostHogConfig(): PostHogConfig {
  const apiKey = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? DEFAULT_HOST
  if (!apiKey || !projectId) {
    throw new Error(
      'POSTHOG_PERSONAL_API_KEY and POSTHOG_PROJECT_ID must both be set. Configure them in Vercel env (production scope) and re-run.',
    )
  }
  return { apiKey, projectId, host }
}

function readAnthropicKey(): string {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY must be set (Claude draft generation step).',
    )
  }
  return key
}

// ─── PostHog ───────────────────────────────────────────────────────────────

async function runHogQL(
  cfg: PostHogConfig,
  query: string,
  signal: AbortSignal,
): Promise<unknown[][]> {
  const url = `${cfg.host.replace(/\/$/, '')}/api/projects/${encodeURIComponent(cfg.projectId)}/query`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: { kind: 'HogQLQuery', query } }),
    signal,
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`PostHog HogQL ${res.status}: ${body.slice(0, 200)}`)
  }
  const data = (await res.json()) as { results?: unknown[][] }
  return data.results ?? []
}

function buildPerSlugCountQuery(event: string, days: number): string {
  // Mirrors the funnel-queries.ts pattern: outer WHERE bounds the
  // event scan, GROUP BY surfaces per-slug counts. Slug nullness is
  // filtered out — pre-launch, every event will have it; defensive
  // for future events without the property.
  return `
    SELECT properties.template_slug AS slug, count() AS cnt
    FROM events
    WHERE event = '${event.replace(/'/g, "''")}'
      AND timestamp > now() - INTERVAL ${days} DAY
      AND properties.template_slug IS NOT NULL
    GROUP BY slug
  `.trim()
}

async function fetchPerSlugCounts(
  cfg: PostHogConfig,
  event: string,
  days: number,
  signal: AbortSignal,
): Promise<Map<string, number>> {
  const rows = await runHogQL(cfg, buildPerSlugCountQuery(event, days), signal)
  const out = new Map<string, number>()
  for (const row of rows) {
    const slug = typeof row[0] === 'string' ? row[0] : null
    const cntRaw = row[1]
    const cnt =
      typeof cntRaw === 'number'
        ? cntRaw
        : typeof cntRaw === 'string'
          ? Number(cntRaw)
          : 0
    if (slug && Number.isFinite(cnt)) {
      out.set(slug, cnt)
    }
  }
  return out
}

// ─── Registry ──────────────────────────────────────────────────────────────

async function readRegistry(): Promise<RegistryTemplate[]> {
  const raw = await readFile(REGISTRY_PATH, 'utf-8')
  const parsed = JSON.parse(raw) as { templates?: unknown }
  if (!Array.isArray(parsed.templates)) {
    throw new Error(`registry.json: expected templates array`)
  }
  const out: RegistryTemplate[] = []
  for (const t of parsed.templates) {
    if (
      t &&
      typeof t === 'object' &&
      typeof (t as Record<string, unknown>).slug === 'string' &&
      typeof (t as Record<string, unknown>).name === 'string'
    ) {
      const r = t as Record<string, unknown>
      out.push({
        slug: r.slug as string,
        name: r.name as string,
        description: typeof r.description === 'string' ? r.description : '',
        category: typeof r.category === 'string' ? r.category : 'uncategorized',
      })
    }
  }
  return out
}

// ─── Freshness via git ──────────────────────────────────────────────────────

/**
 * Returns days-since-first-commit for the per-slug template manifest
 * file under apps/web/public/templates/<slug>.json. Returns null on
 * any failure (no git history, file too new for git to know, shallow
 * clone, slug rejected by assertSafeSlug, git not on PATH).
 * Caller treats null as "no freshness bonus" — never blocks
 * selection.
 *
 * Uses execFileSync (NOT execSync) with explicit argv to keep the
 * shell out of the path: a slug from the registry should be safe
 * (kebab-case validated upstream) but defense-in-depth keeps a future
 * registry-schema relaxation from turning into a command-injection
 * surface here.
 *
 * Scale: O(N templates) git invocations per run. ~50ms each on a
 * warm fs cache; 97 templates → ~5s. Past ~5000 templates this
 * should switch to a single `git log --diff-filter=A` over the
 * whole templates dir followed by per-path attribution.
 */
function daysSinceTemplateAdded(slug: string, today: Date): number | null {
  try {
    assertSafeSlug(slug)
  } catch {
    return null
  }
  const targetPath = `apps/web/public/templates/${slug}.json`
  try {
    const stdout = execFileSync(
      'git',
      ['log', '--diff-filter=A', '--follow', '--format=%cI', '--', targetPath],
      {
        cwd: REPO_ROOT,
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      },
    )
    // git log emits multiple lines on rename history; the last is
    // the FIRST add (oldest), which is what we want for "days since
    // added".
    const lines = stdout.split('\n').filter((l) => l.trim().length > 0)
    const isoDate = lines[lines.length - 1]?.trim()
    if (!isoDate) return null
    const ms = Date.parse(isoDate)
    if (!Number.isFinite(ms)) return null
    const diffDays = Math.floor((today.getTime() - ms) / (24 * 60 * 60 * 1000))
    return diffDays >= 0 ? diffDays : 0
  } catch {
    return null
  }
}

// ─── Anthropic draft generation ────────────────────────────────────────────

async function generateDraft(args: {
  apiKey: string
  templateName: string
  templateSlug: string
  templateDescription: string
  templateCategory: string
  scaffoldCount: number
  viewCount: number
  daysSinceAdded: number | null
}): Promise<string> {
  const client = new Anthropic({ apiKey: args.apiKey })
  const { system, user } = buildDraftPrompt({
    templateName: args.templateName,
    templateSlug: args.templateSlug,
    templateDescription: args.templateDescription,
    templateCategory: args.templateCategory,
    scaffoldCount: args.scaffoldCount,
    viewCount: args.viewCount,
    daysSinceAdded: args.daysSinceAdded,
    exampleEntryFile: 'apps/web/src/lib/blog-bodies/x402-facilitator-launch.md',
  })
  const res = await client.messages.create({
    model: ANTHROPIC_MODEL,
    max_tokens: ANTHROPIC_MAX_TOKENS,
    system,
    messages: [{ role: 'user', content: user }],
  })
  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim()
  if (!text) {
    throw new Error(
      `Anthropic returned empty content (stop_reason=${res.stop_reason})`,
    )
  }
  return text
}

// ─── registered.ts splice ──────────────────────────────────────────────────

interface SplicePayload {
  importBinding: string
  bodyFilename: string
  postSlug: string
  templateName: string
  templateSlug: string
  date: string
  wordCount: number
  body: string // for keyword extraction
}

const IMPORTS_BEGIN = '// TOTW_IMPORTS_BEGIN'
const IMPORTS_END = '// TOTW_IMPORTS_END'
const ENTRIES_BEGIN = '// TOTW_ENTRIES_BEGIN'
const ENTRIES_END = '// TOTW_ENTRIES_END'

async function spliceRegistered(payload: SplicePayload): Promise<void> {
  const current = await readFile(REGISTERED_PATH, 'utf-8')

  const importLine = `import ${payload.importBinding} from './${payload.bodyFilename}'`
  const entryBlock = renderEntryBlock(payload)

  // Per-marker check: insertBefore returns input unchanged when the
  // marker is absent. Doing both inserts and then checking only
  // `next === current` would silently produce a half-spliced file
  // when one marker is present and the other has been removed by an
  // operator. Check each insert independently.
  const afterImport = insertBefore(current, IMPORTS_END, importLine + '\n')
  if (afterImport === current) {
    throw new Error(
      `Marker ${IMPORTS_END} not found in ${REGISTERED_PATH}. Restore the BEGIN/END comment markers before re-running.`,
    )
  }

  const afterEntry = insertBefore(afterImport, ENTRIES_END, entryBlock + '\n')
  if (afterEntry === afterImport) {
    throw new Error(
      `Marker ${ENTRIES_END} not found in ${REGISTERED_PATH}. Restore the BEGIN/END comment markers before re-running.`,
    )
  }

  await writeFile(REGISTERED_PATH, afterEntry, 'utf-8')
}

function insertBefore(haystack: string, marker: string, payload: string): string {
  const idx = haystack.indexOf(marker)
  if (idx === -1) return haystack
  return haystack.slice(0, idx) + payload + haystack.slice(idx)
}

function renderEntryBlock(p: SplicePayload): string {
  const escapedTitle = escapeForTsString(`${p.templateName} — Template of the Week`)
  const escapedDescription = escapeForTsString(
    `Why ${p.templateName} caught our eye this week — what it does, the minimal setup, and the angle that makes it worth a paragraph today.`,
  )
  // Reading-time at 240 wpm rounded up to nearest minute.
  const readingMin = Math.max(1, Math.ceil(p.wordCount / 240))
  return [
    `  {`,
    `    slug: '${p.postSlug}',`,
    `    title: ${escapedTitle},`,
    `    description: ${escapedDescription},`,
    `    datePublished: '${p.date}',`,
    `    dateModified: '${p.date}',`,
    `    keywords: [`,
    `      'SettleGrid template',`,
    `      'MCP server',`,
    `      'template of the week',`,
    `      ${escapeForTsString(p.templateName)},`,
    `    ],`,
    `    readingTime: '${readingMin} min read',`,
    `    wordCount: ${p.wordCount},`,
    `    author: {`,
    `      name: 'Lex Whiting',`,
    `      url: 'https://x.com/lexwhiting',`,
    `      bio: 'Founder, SettleGrid. Bootstrapping a settlement layer for the AI economy.',`,
    `    },`,
    `    relatedSlugs: ['settlegrid-templates-launch'],`,
    `    body: ${p.importBinding},`,
    `    published: false,`,
    `  },`,
  ].join('\n')
}

/**
 * Escape an arbitrary string for embedding inside a single-quoted TS
 * string literal. Order matters: backslash first (so it doesn't
 * double-escape the escapes added after), then quotes, then line
 * terminators (which would break the literal). U+2028 / U+2029
 * don't need escaping at modern TS targets (ES2019+ allows them as
 * literal characters); Next.js builds at ES2022.
 */
function escapeForTsString(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

// ─── Output JSON ────────────────────────────────────────────────────────────

async function writeOutput(path: string, output: Output): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(output, null, 2) + '\n', 'utf-8')
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv)

  // Env first — fail loud before any I/O.
  const phCfg = readPostHogConfig()
  // We tolerate missing ANTHROPIC_API_KEY if the run is going to bail
  // at "no candidate" anyway, but it's cheap to validate up front and
  // gives a cleaner error than discovering it after PostHog returns.
  const anthropicKey = readAnthropicKey()

  const todayDate = formatDateUtc(args.today)

  const [registry, history] = await Promise.all([
    readRegistry(),
    readHistory(HISTORY_PATH),
  ])
  const blocked = recentlyFeaturedSlugs(history, args.today)

  // PostHog round-trip with internal timeout.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), POSTHOG_TIMEOUT_MS)
  let scaffoldCounts: Map<string, number>
  let viewCounts: Map<string, number>
  try {
    ;[scaffoldCounts, viewCounts] = await Promise.all([
      fetchPerSlugCounts(phCfg, 'scaffold_success', args.days, controller.signal),
      fetchPerSlugCounts(phCfg, 'template_detail_viewed', args.days, controller.signal),
    ])
  } finally {
    clearTimeout(timer)
  }

  // Build scoring inputs. Every registry slug is a candidate; it just
  // gets 0 + 0 if no PostHog signal in the window.
  const scoringInputs: TotwScoringInput[] = registry.map((t) => ({
    slug: t.slug,
    scaffoldCount: scaffoldCounts.get(t.slug) ?? 0,
    viewCount: viewCounts.get(t.slug) ?? 0,
    daysSinceAdded: daysSinceTemplateAdded(t.slug, args.today),
  }))

  const winner = pickWinner(scoringInputs, blocked)
  if (!winner) {
    const reason =
      registry.length === 0
        ? 'registry empty'
        : scoringInputs.every((s) => s.scaffoldCount === 0 && s.viewCount === 0)
          ? 'PostHog returned zero signal across all templates in window — likely pre-launch or quiet week'
          : 'every remaining candidate scored 0 (all unblocked candidates had no scaffold/view activity)'
    const out: OutputNoCandidate = {
      status: 'no_candidate',
      reason,
      scoredCount: scoringInputs.length,
      recentlyFeaturedCount: blocked.size,
    }
    await writeOutput(args.outputPath, out)
    console.log(JSON.stringify(out, null, 2))
    return
  }

  // Found a winner — generate, validate, write, register, history.
  const winnerTemplate = registry.find((t) => t.slug === winner.slug)
  if (!winnerTemplate) {
    throw new Error(`Internal: winner ${winner.slug} not found in registry`)
  }

  const draftBody = await generateDraft({
    apiKey: anthropicKey,
    templateName: winnerTemplate.name,
    templateSlug: winnerTemplate.slug,
    templateDescription: winnerTemplate.description,
    templateCategory: winnerTemplate.category,
    scaffoldCount: winner.scaffoldCount,
    viewCount: winner.viewCount,
    daysSinceAdded: winner.daysSinceAdded,
  })

  const validation = validateDraft(draftBody)
  if (!validation.ok) {
    throw new Error(
      `Generated draft failed validation: ${validation.reason} (wc=${validation.wordCount})\n\n${draftBody.slice(0, 800)}…`,
    )
  }
  const wordCount = countWords(draftBody)

  const paths = makeDraftPaths(winner.slug, todayDate)
  const draftFileAbs = join(TOTW_BODIES_DIR, paths.bodyFilename)

  const drafted: OutputDrafted = {
    status: 'drafted',
    slug: winner.slug,
    templateName: winnerTemplate.name,
    date: todayDate,
    postSlug: paths.postSlug,
    draftFile: paths.bodyPath,
    registryFile: 'apps/web/src/lib/blog-bodies/totw/registered.ts',
    historyFile: 'docs/content/totw-history.json',
    score: winner.score,
    scoreComponents: winner.components,
    wordCount,
    dryRun: args.dryRun,
  }

  if (!args.dryRun) {
    await mkdir(TOTW_BODIES_DIR, { recursive: true })
    await writeFile(draftFileAbs, draftBody.trim() + '\n', 'utf-8')
    await spliceRegistered({
      importBinding: paths.importBinding,
      bodyFilename: paths.bodyFilename,
      postSlug: paths.postSlug,
      templateName: winnerTemplate.name,
      templateSlug: winnerTemplate.slug,
      date: todayDate,
      wordCount,
      body: draftBody,
    })
    const entry: TotwHistoryEntry = {
      slug: winner.slug,
      featuredAt: todayDate,
      score: winner.score,
    }
    await appendHistory(HISTORY_PATH, entry)
  } else {
    drafted.body = draftBody.trim()
  }

  await writeOutput(args.outputPath, drafted)
  console.log(JSON.stringify(drafted, null, 2))
}

// ─── Entry ──────────────────────────────────────────────────────────────────

function isMainEntry(): boolean {
  try {
    const scriptPath = realpathSync(fileURLToPath(import.meta.url))
    const entryPath = realpathSync(process.argv[1])
    return scriptPath === entryPath
  } catch {
    return false
  }
}

if (isMainEntry()) {
  main().catch((err) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`template-of-the-week: ${msg}`)
    process.exit(1)
  })
}
