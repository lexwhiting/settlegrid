#!/usr/bin/env npx tsx
/**
 * P4.6 — Second-batch outreach generator.
 *
 * Builds 100 personalized email drafts into a SINGLE reviewable
 * markdown file at docs/launch/outreach-batch-2.md. The founder
 * sends the emails by hand from a personal mailbox — this script
 * NEVER calls a transactional email API, by design.
 *
 * ## Usage
 *
 *   GITHUB_TOKEN=ghp_...                        \
 *   ANTHROPIC_API_KEY=sk-ant-...                \
 *   FOUNDER_NAME=Lex                            \
 *   FOUNDER_ROLE=Founder                        \
 *   COMPANY_NAME="SettleGrid (Alerterra, LLC)"  \
 *   PHYSICAL_ADDRESS="123 Example St, San Francisco, CA 94110" \
 *   BLOG_URL=https://settlegrid.ai/learn/blog/settlegrid-templates-launch \
 *     npx tsx scripts/build-outreach-batch.ts [--dry-run] [--no-cache] [--skip-personalize]
 *
 * Flags:
 *   --dry-run          Plan the batch (counts per tier) without calling Claude.
 *   --no-cache         Force fresh GitHub + Claude calls (ignore .cache).
 *   --skip-personalize Use a placeholder line; founder hand-writes after review.
 *   --limit N          Cap total drafts at N (default 100).
 *   --hot-limit N      Cap hot drafts (default 30).
 *   --warm-limit N     Cap warm drafts (default 30).
 *   --cold-limit N     Cap cold drafts (default 40).
 *
 * ## Idempotency
 *
 * Every external API call is cached to disk under
 * `scripts/.cache/<bucket>/<sha1>.json`. Re-runs hit the cache
 * and don't re-issue paid Claude calls. Use `--no-cache` to
 * force a refresh.
 *
 * ## CAN-SPAM compliance
 *
 * The script asserts every required RenderConfig field is set
 * BEFORE generating any draft. Missing FOUNDER_NAME,
 * PHYSICAL_ADDRESS, etc. aborts the run loudly rather than
 * producing 100 broken footers. See render.ts → assertCanSpamConfig.
 *
 * ## Spec deviation flagged for Round 2
 *
 * The spec says the hot list is "forks of settlegrid/templates-*";
 * the actual repo pattern in the codebase is
 * `https://github.com/settlegrid/settlegrid-<slug>` (per template
 * in apps/web/public/registry.json). The script enumerates
 * registry templates and queries forks of each — same intent,
 * actual paths.
 */
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { personalize } from '../apps/web/src/lib/outreach/personalize.js'
import {
  assertCanSpamConfig,
  readLaunchLiveTemplate,
  renderDraft,
  renderReviewBlock,
  type RenderConfig,
} from '../apps/web/src/lib/outreach/render.js'
import type {
  Target,
  TargetIdentity,
  TargetSignal,
  TargetTier,
  DraftEmail,
} from '../apps/web/src/lib/outreach/targets.js'

// ── Constants ──────────────────────────────────────────────────────────────

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(SCRIPT_DIR, '..')
const CACHE_ROOT = join(SCRIPT_DIR, '.cache')
const REGISTRY_PATH = join(REPO_ROOT, 'apps/web/public/registry.json')
/**
 * Default output path. Lives under `scripts/.outreach/` (gitignored)
 * because the rendered file contains real names + email addresses
 * pulled from the GitHub API — committing it leaks PII. The
 * committed sample stub at `docs/launch/outreach-batch-2.md` shows
 * the format only and is intentionally not the default target.
 * Override with `--out <path>` for ad-hoc destinations.
 */
const DEFAULT_OUTPUT_PATH = join(SCRIPT_DIR, '.outreach', 'batch-2.md')
/**
 * Default warm-list sources. Spec literal: "Contributors to
 * punkpeye/awesome-mcp-servers and similar lists." We start with
 * the canonical list and let the operator extend via the
 * AWESOME_MCP_LISTS env var (comma-separated `owner/repo`).
 */
const DEFAULT_AWESOME_MCP_LISTS = ['punkpeye/awesome-mcp-servers']

function getAwesomeMcpLists(): string[] {
  const raw = process.env.AWESOME_MCP_LISTS?.trim()
  if (!raw) return DEFAULT_AWESOME_MCP_LISTS
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => /^[^/\s]+\/[^/\s]+$/.test(s))
}

const DEFAULT_LIMITS: Record<TargetTier, number> = {
  hot: 30,
  warm: 30,
  cold: 40,
}

// ── CLI args ───────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  noCache: boolean
  skipPersonalize: boolean
  totalLimit: number
  tierLimits: Record<TargetTier, number>
  outPath: string | null
}

/**
 * Validate a CLI numeric argument. parseInt('foo') is NaN, which
 * silently propagates into `slice(0, NaN)` (returns []) and
 * produces zero drafts with no error. Throw loudly instead.
 */
function parsePositiveInt(raw: string, flagName: string): number {
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0 || String(parsed) !== raw.trim()) {
    throw new Error(
      `${flagName} expects a positive integer; got ${JSON.stringify(raw)}`,
    )
  }
  return parsed
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    noCache: false,
    skipPersonalize: false,
    totalLimit: 100,
    tierLimits: { ...DEFAULT_LIMITS },
    outPath: null,
  }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--no-cache') args.noCache = true
    else if (a === '--skip-personalize') args.skipPersonalize = true
    else if (a === '--limit' && argv[i + 1]) {
      args.totalLimit = parsePositiveInt(argv[++i], '--limit')
    } else if (a === '--hot-limit' && argv[i + 1]) {
      args.tierLimits.hot = parsePositiveInt(argv[++i], '--hot-limit')
    } else if (a === '--warm-limit' && argv[i + 1]) {
      args.tierLimits.warm = parsePositiveInt(argv[++i], '--warm-limit')
    } else if (a === '--cold-limit' && argv[i + 1]) {
      args.tierLimits.cold = parsePositiveInt(argv[++i], '--cold-limit')
    } else if (a === '--out' && argv[i + 1]) {
      args.outPath = argv[++i]
    }
  }
  return args
}

// ── Render config from env ─────────────────────────────────────────────────

function loadRenderConfigFromEnv(): RenderConfig {
  const cfg: RenderConfig = {
    founderName: process.env.FOUNDER_NAME ?? '',
    founderRole: process.env.FOUNDER_ROLE ?? '',
    companyName: process.env.COMPANY_NAME ?? '',
    physicalAddress: process.env.PHYSICAL_ADDRESS ?? '',
    blogUrl: process.env.BLOG_URL ?? '',
    galleryUrl: process.env.GALLERY_URL ?? 'https://settlegrid.ai/templates',
    unsubscribeUrl: process.env.UNSUBSCRIBE_URL ?? '',
  }
  assertCanSpamConfig(cfg) // throws with a useful message if missing
  return cfg
}

// ── GitHub API client ──────────────────────────────────────────────────────

/** Custom error so the script can stop cleanly on rate-limit exhaustion. */
export class GithubRateLimitError extends Error {
  constructor(public readonly resetAt: number | null) {
    super(
      `GitHub rate limit exhausted${
        resetAt
          ? ` (resets at ${new Date(resetAt * 1000).toISOString()})`
          : ''
      }. Re-run after the reset.`,
    )
    this.name = 'GithubRateLimitError'
  }
}

interface GithubFetchOptions {
  cacheBucket: string
  cacheKey: string
  noCache: boolean
}

async function ghFetch<T>(
  url: string,
  options: GithubFetchOptions,
): Promise<T | null> {
  if (!options.noCache) {
    const cached = readCache<T>(options.cacheBucket, options.cacheKey)
    if (cached !== null) return cached
  }
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'user-agent': 'settlegrid-outreach-batch/1.0',
    'x-github-api-version': '2022-11-28',
  }
  const token = process.env.GITHUB_TOKEN
  if (token) headers.authorization = `Bearer ${token}`

  const res = await fetch(url, { headers })
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get('x-ratelimit-remaining')
    if (remaining === '0') {
      const reset = res.headers.get('x-ratelimit-reset')
      const resetAt = reset ? parseInt(reset, 10) : null
      throw new GithubRateLimitError(resetAt)
    }
  }
  if (res.status === 404) return null
  if (!res.ok) {
    console.error(`GitHub ${url} → ${res.status}`)
    return null
  }
  const data = (await res.json()) as T
  writeCache(options.cacheBucket, options.cacheKey, data)
  return data
}

interface GithubUser {
  login: string
  name: string | null
  email: string | null
  bio: string | null
}
interface GithubRepo {
  full_name: string
  owner: { login: string }
  language: string | null
  stargazers_count: number
}
interface GithubFork extends GithubRepo {
  parent?: { full_name: string }
}
interface GithubCommit {
  commit: { message: string }
}

async function fetchUser(
  login: string,
  noCache: boolean,
): Promise<GithubUser | null> {
  return ghFetch<GithubUser>(`https://api.github.com/users/${login}`, {
    cacheBucket: 'github-user',
    cacheKey: login,
    noCache,
  })
}

async function fetchUserRecentRepos(
  login: string,
  noCache: boolean,
): Promise<GithubRepo[]> {
  const repos = await ghFetch<GithubRepo[]>(
    `https://api.github.com/users/${login}/repos?sort=pushed&per_page=5`,
    {
      cacheBucket: 'github-user-repos',
      cacheKey: login,
      noCache,
    },
  )
  return repos ?? []
}

/**
 * Fetch the user's most recent PR or issue title from the public
 * events feed (`/users/<login>/events/public`). Returns null when
 * the feed has no PR/IssueEvent in the last 30 events (the API
 * returns 30 by default; older events are dropped from the feed).
 *
 * Spec literal: "one specific recent PR or issue."
 */
async function fetchRecentActivity(
  login: string,
  noCache: boolean,
): Promise<{ type: 'PR' | 'issue'; title: string } | null> {
  // GitHub's events feed shape — we only care about PRs + issues,
  // hence the narrow type. The API includes many more event types
  // (PushEvent, WatchEvent, etc.) which we ignore.
  interface Event {
    type: string
    payload: {
      pull_request?: { title?: string }
      issue?: { title?: string }
    }
  }
  const events = await ghFetch<Event[]>(
    `https://api.github.com/users/${login}/events/public?per_page=30`,
    {
      cacheBucket: 'github-user-events',
      cacheKey: login,
      noCache,
    },
  )
  if (!events) return null
  for (const e of events) {
    if (e.type === 'PullRequestEvent' && e.payload.pull_request?.title) {
      return { type: 'PR', title: e.payload.pull_request.title.slice(0, 200) }
    }
    if (e.type === 'IssuesEvent' && e.payload.issue?.title) {
      return { type: 'issue', title: e.payload.issue.title.slice(0, 200) }
    }
  }
  return null
}

async function fetchLatestCommitMessage(
  fullName: string,
  noCache: boolean,
): Promise<string | null> {
  const commits = await ghFetch<GithubCommit[]>(
    `https://api.github.com/repos/${fullName}/commits?per_page=1`,
    {
      cacheBucket: 'github-repo-commit',
      cacheKey: fullName.replace('/', '__'),
      noCache,
    },
  )
  if (!commits || commits.length === 0) return null
  // First line of commit message — multi-paragraph commit bodies
  // are common but only the headline is useful for personalization.
  const headline = (commits[0].commit.message ?? '')
    .split('\n')[0]
    .trim()
  return headline.length > 0 ? headline : null
}

// ── Fetchers per tier ──────────────────────────────────────────────────────

/**
 * Hot list: developers who forked a Phase-2 template repo. The
 * registry at `apps/web/public/registry.json` lists every template
 * with a `repo.url`. We enumerate forks of each and dedupe by
 * github_login.
 */
async function fetchHotTargets(
  noCache: boolean,
  limit: number,
): Promise<Array<{ login: string; forkedRepo: string }>> {
  const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8')) as {
    templates: Array<{ slug: string; repo: { url: string } }>
  }
  const seen = new Set<string>()
  const out: Array<{ login: string; forkedRepo: string }> = []

  for (const tmpl of registry.templates) {
    if (out.length >= limit) break
    // repo.url shape: https://github.com/settlegrid/settlegrid-<slug>
    const match = tmpl.repo.url.match(/github\.com\/([^/]+)\/([^/?#]+)/)
    if (!match) continue
    const fullName = `${match[1]}/${match[2]}`
    const forks = await ghFetch<GithubFork[]>(
      `https://api.github.com/repos/${fullName}/forks?per_page=5`,
      {
        cacheBucket: 'github-forks',
        cacheKey: fullName.replace('/', '__'),
        noCache,
      },
    )
    if (!forks) continue
    for (const fork of forks) {
      const login = fork.owner.login
      if (seen.has(login)) continue
      seen.add(login)
      out.push({ login, forkedRepo: tmpl.repo.url })
      if (out.length >= limit) break
    }
  }
  return out
}

/**
 * Warm list: contributors to public MCP awesome-lists. The
 * GitHub API exposes contributors per repo; we round-robin over
 * the configured lists and dedupe by login. Default list is
 * `punkpeye/awesome-mcp-servers`; operators can extend via
 * `AWESOME_MCP_LISTS=owner1/repo1,owner2/repo2`.
 */
async function fetchWarmTargets(
  noCache: boolean,
  limit: number,
): Promise<string[]> {
  const lists = getAwesomeMcpLists()
  const seen = new Set<string>()
  const out: string[] = []
  // Round-robin: fetch a page per list, then merge in interleaved
  // order so every list contributes some breadth. Ensures the
  // warm batch isn't dominated by a single list's top
  // contributors.
  const perPageEach = Math.min(100, Math.max(limit, 30))
  const allContributorLists: Array<Array<{ login: string }>> = []
  for (const list of lists) {
    const contributors = await ghFetch<Array<{ login: string }>>(
      `https://api.github.com/repos/${list}/contributors?per_page=${perPageEach}`,
      {
        cacheBucket: 'github-contributors',
        cacheKey: list.replace('/', '__'),
        noCache,
      },
    )
    allContributorLists.push(contributors ?? [])
  }
  // Interleave round-robin across lists.
  let i = 0
  while (out.length < limit) {
    let progressed = false
    for (const list of allContributorLists) {
      const c = list[i]
      if (!c) continue
      progressed = true
      if (seen.has(c.login)) continue
      seen.add(c.login)
      out.push(c.login)
      if (out.length >= limit) break
    }
    if (!progressed) break
    i++
  }
  return out
}

/**
 * Cold list: shadow-directory entries with ≥ 10 stars. The
 * canonical source is the `mcp_shadow_index` table in our DB.
 * We import the shadow-index reader from apps/web; if the DB is
 * unavailable (no DATABASE_URL), the reader returns [] and the
 * script emits a warning rather than crashing.
 */
async function fetchColdTargets(
  limit: number,
): Promise<Array<{ owner: string; repo: string; stars: number }>> {
  try {
    // Lazy import — only loads drizzle/db if --skip-personalize is
    // off and we need cold targets. Keeps the script's startup cost
    // low for --dry-run flows.
    const mod = await import('../apps/web/src/lib/shadow-index.js')
    const entries = await mod.getAllShadowEntries(limit * 3)
    return entries
      .filter((e: { stars: number | null }) => (e.stars ?? 0) >= 10)
      .slice(0, limit)
      .map((e: { owner: string; repo: string; stars: number | null }) => ({
        owner: e.owner,
        repo: e.repo,
        stars: e.stars ?? 0,
      }))
  } catch (err) {
    // DATABASE_URL unset, table missing, or transient connection
    // failure. Cold tier degrades to empty rather than aborting the
    // run — hot + warm still produce drafts. Operator can fix the
    // DB and re-run with --no-cache to retry.
    console.warn(
      `⚠️  fetchColdTargets failed (${
        err instanceof Error ? err.message : String(err)
      }). Continuing without cold targets — hot + warm only.`,
    )
    return []
  }
}

// ── Cache helpers ──────────────────────────────────────────────────────────

function cachePath(bucket: string, key: string): string {
  const safe = createHash('sha1').update(key).digest('hex')
  return join(CACHE_ROOT, bucket, `${safe}.json`)
}
function readCache<T>(bucket: string, key: string): T | null {
  const p = cachePath(bucket, key)
  if (!existsSync(p)) return null
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T
  } catch {
    return null
  }
}
function writeCache<T>(bucket: string, key: string, value: T): void {
  const p = cachePath(bucket, key)
  mkdirSync(dirname(p), { recursive: true })
  writeFileSync(p, JSON.stringify(value, null, 2))
}

// ── Target enrichment ──────────────────────────────────────────────────────

async function enrichTarget(args: {
  login: string
  tier: TargetTier
  forkedRepo: string | null
  coldStars: number | null
  noCache: boolean
}): Promise<Target | null> {
  const user = await fetchUser(args.login, args.noCache)
  if (!user) return null
  const repos = await fetchUserRecentRepos(args.login, args.noCache)
  const recentRepo = repos[0] ?? null
  const recentCommit = recentRepo
    ? await fetchLatestCommitMessage(recentRepo.full_name, args.noCache)
    : null
  const recentActivity = await fetchRecentActivity(args.login, args.noCache)
  const identity: TargetIdentity = {
    githubLogin: user.login,
    name: user.name?.trim() || user.login,
    email: user.email?.trim() || null,
  }
  const signal: TargetSignal = {
    bio: user.bio?.trim() || null,
    recentRepoName: recentRepo?.full_name ?? null,
    recentCommitMessage: recentCommit,
    primaryLanguage: recentRepo?.language ?? null,
    recentActivityType: recentActivity?.type ?? null,
    recentActivityTitle: recentActivity?.title ?? null,
    starCount: args.coldStars,
    forkedTemplateRepo: args.forkedRepo,
  }
  return { tier: args.tier, identity, signal }
}

// ── Personalize loop ───────────────────────────────────────────────────────

interface PersonalizeCacheEntry {
  line: string
  generatedAt: string
}

async function personalizeWithCache(
  target: Target,
  noCache: boolean,
  skipPersonalize: boolean,
): Promise<{ line: string; cached: boolean; failed: boolean }> {
  if (skipPersonalize) {
    return {
      line: '{{personalization placeholder — founder rewrites by hand}}',
      cached: false,
      failed: false,
    }
  }
  // Cache key includes every signal field that the prompt actually
  // reads. Missing recentActivityType/Title here would silently
  // serve a stale line when a contributor opens a new PR/issue
  // since the last run.
  const cacheKey = [
    target.identity.githubLogin,
    target.signal.recentRepoName ?? '',
    target.signal.recentActivityType ?? '',
    target.signal.recentActivityTitle ?? '',
    target.signal.recentCommitMessage ?? '',
  ].join('::')
  if (!noCache) {
    const hit = readCache<PersonalizeCacheEntry>('personalize', cacheKey)
    if (hit) return { line: hit.line, cached: true, failed: false }
  }
  const result = await personalize(target.identity, target.signal)
  if (!result.ok) {
    return {
      line: `{{personalization failed: ${result.reason} — founder rewrites}}`,
      cached: false,
      failed: true,
    }
  }
  writeCache<PersonalizeCacheEntry>('personalize', cacheKey, {
    line: result.line,
    generatedAt: new Date().toISOString(),
  })
  return { line: result.line, cached: false, failed: false }
}

// ── Main ───────────────────────────────────────────────────────────────────

export async function main(argv: string[] = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv)
  const config = loadRenderConfigFromEnv()
  const template = readLaunchLiveTemplate()

  // GitHub's unauthenticated rate limit is 60/hr — well under the
  // ~3-4 calls per target × 100 targets the script makes. Warn
  // immediately so the founder doesn't lose 30 seconds before the
  // 403 lands.
  if (!process.env.GITHUB_TOKEN) {
    console.warn(
      '⚠️  GITHUB_TOKEN is not set. Unauthenticated GitHub API requests are limited to 60/hour and will fail well before 100 targets are processed. Set GITHUB_TOKEN to a personal access token (no scopes needed for public data) and re-run.',
    )
  }

  console.log('Loading targets…')
  const hotPicks = await fetchHotTargets(args.noCache, args.tierLimits.hot)
  const warmPicks = await fetchWarmTargets(args.noCache, args.tierLimits.warm)
  const coldPicks = await fetchColdTargets(args.tierLimits.cold)
  console.log(
    `  hot: ${hotPicks.length}/${args.tierLimits.hot}  warm: ${warmPicks.length}/${args.tierLimits.warm}  cold: ${coldPicks.length}/${args.tierLimits.cold}`,
  )

  if (args.dryRun) {
    console.log('--dry-run: exiting before any Claude calls.')
    return
  }

  const targets: Target[] = []
  for (const p of hotPicks) {
    const t = await enrichTarget({
      login: p.login,
      tier: 'hot',
      forkedRepo: p.forkedRepo,
      coldStars: null,
      noCache: args.noCache,
    })
    if (t) targets.push(t)
  }
  for (const login of warmPicks) {
    const t = await enrichTarget({
      login,
      tier: 'warm',
      forkedRepo: null,
      coldStars: null,
      noCache: args.noCache,
    })
    if (t) targets.push(t)
  }
  for (const c of coldPicks) {
    const t = await enrichTarget({
      login: c.owner,
      tier: 'cold',
      forkedRepo: null,
      coldStars: c.stars,
      noCache: args.noCache,
    })
    if (t) targets.push(t)
  }

  // Cap total
  const capped = targets.slice(0, args.totalLimit)
  console.log(`Personalizing ${capped.length} targets…`)

  const drafts: DraftEmail[] = []
  let cachedCount = 0
  let failedCount = 0
  for (const target of capped) {
    const { line, cached, failed } = await personalizeWithCache(
      target,
      args.noCache,
      args.skipPersonalize,
    )
    if (cached) cachedCount++
    if (failed) failedCount++
    const draft = renderDraft({
      target,
      personalizationLine: line,
      template,
      config,
    })
    drafts.push(draft)
  }
  console.log(
    `  ok=${drafts.length} cached=${cachedCount} failed=${failedCount}`,
  )

  // Render the review file. Stable order: hot first, then warm,
  // then cold; within each tier, order of fetch.
  const lines: string[] = [
    '<!--',
    '  ⚠️  DO NOT COMMIT THIS FILE — IT CONTAINS PII (REAL NAMES + EMAIL ADDRESSES)  ⚠️',
    '  ============================================================================',
    '  This file is generated by scripts/build-outreach-batch.ts and',
    '  contains personal data scraped from the public GitHub API.',
    '  By default it is written under scripts/.outreach/, which is',
    '  gitignored. If you re-pointed the output via --out, verify',
    '  with `git check-ignore <path>` BEFORE running `git add`.',
    '',
    '  Generated by scripts/build-outreach-batch.ts.',
    '  Re-running the script regenerates this file deterministically;',
    '  cached personalization stays stable across runs unless --no-cache.',
    '',
    '  CHECK BEFORE SENDING:',
    '    1. Every email has a recipient address (entries flagged',
    '       "(email missing — resolve before sending)" need lookup).',
    '    2. Every personalization line passes the "would I send this',
    '       to a real person?" test. Failures flagged inline.',
    '    3. Subject does not start with "Re:" (renderer asserts).',
    '    4. Physical address in the footer is current.',
    '-->',
    '',
    `# Outreach Batch 2 — ${new Date().toISOString().slice(0, 10)}`,
    '',
    `Total drafts: ${drafts.length}. Personalization cache hits: ${cachedCount}. Failures (need hand-write): ${failedCount}.`,
    '',
    '---',
    '',
  ]
  drafts.forEach((draft, i) => {
    lines.push(renderReviewBlock(i + 1, draft))
  })
  const outPath = args.outPath ?? DEFAULT_OUTPUT_PATH
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(outPath, lines.join('\n'))
  console.log(`Wrote ${outPath}`)
  console.log('⚠️  Output contains PII — DO NOT COMMIT.')
}

// ── Entrypoint guard ────────────────────────────────────────────────────────

const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('build-outreach-batch.ts') === true ||
  process.argv[1]?.endsWith('build-outreach-batch.js') === true

if (isMain) {
  main().catch((err: unknown) => {
    console.error('build-outreach-batch failed:', err)
    process.exitCode = 1
  })
}

// re-export for tests
export {
  parseArgs,
  parsePositiveInt,
  getAwesomeMcpLists,
  loadRenderConfigFromEnv,
  fetchHotTargets,
  fetchWarmTargets,
  fetchColdTargets,
  enrichTarget,
  personalizeWithCache,
}
