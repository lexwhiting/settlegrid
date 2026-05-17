/**
 * P4.1 — CLI telemetry.
 *
 * The CLI is a Node process, not a browser. It captures funnel events
 * (cli_install_started, scaffold_success, scaffold_failed) by POSTing
 * to the SettleGrid telemetry proxy at
 * `${SETTLEGRID_API_URL ?? 'https://settlegrid.ai'}/api/telemetry/capture`.
 *
 * The PostHog project key is added by the proxy server-side. The CLI
 * NEVER ships a PostHog key in its npm tarball — that's the load-
 * bearing reason this proxy exists. See docs/telemetry/events.md.
 *
 * ## distinct_id resolution
 *
 *   - Browser: PostHog's anonymous-cookie ID (managed by posthog-js).
 *   - CLI: random UUID written to `~/.settlegrid/telemetry-id` on
 *     first run. File mode 0600 so a multi-user system doesn't
 *     leak the ID across users. Recreated if missing or unreadable.
 *   - SDK: sha256(toolSlug). See packages/mcp/src/telemetry.ts.
 *
 * ## Opt-out
 *
 * `SETTLEGRID_TELEMETRY=0` (also accepts `false`, `no`, `off` —
 * case-insensitive, whitespace-tolerant). Postinstall and every
 * `settlegrid <cmd>` invocation respect the same env var.
 *
 * ## Hostile invariants applied at scaffold time
 *
 *   - Telemetry NEVER throws into product code. Every public function
 *     swallows errors and returns a boolean / void. A 500 from the
 *     proxy, a network drop, or a misconfigured HOMEDIR must not
 *     break `npm install` or `settlegrid add`.
 *   - 2-second timeout via AbortController on every POST. The CLI
 *     should never hang on a flaky telemetry endpoint.
 *   - distinct_id file written with mode 0600 (user-only read/write)
 *     and the parent dir with mode 0700.
 *   - No retries — telemetry is best-effort.
 *
 * @packageDocumentation
 */
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import * as path from 'node:path'
import { randomUUID } from 'node:crypto'

/** Default proxy URL — overridden by SETTLEGRID_API_URL for tests + dev. */
const DEFAULT_PROXY_BASE = 'https://settlegrid.ai'

/** Hard cap on how long telemetry can block CLI exit. */
const TELEMETRY_TIMEOUT_MS = 2000

/** Allow-listed event names — must match docs/telemetry/events.md. */
export type CliEventName =
  | 'cli_install_started'
  | 'scaffold_success'
  | 'scaffold_failed'

/** Scaffold-failure error code allow-list (see events.md). */
export type ScaffoldErrorCode =
  | 'unknown_repo_type'
  | 'transform_error'
  | 'pr_failed'
  | 'resolve_error'
  | 'unknown'

// ─── Opt-out + base URL ─────────────────────────────────────────────────────

/**
 * Read the SETTLEGRID_TELEMETRY env var with the same case/whitespace
 * tolerance as the apps/web `useUnifiedAdapters` helper. The user
 * setting `SETTLEGRID_TELEMETRY=0` MUST disable telemetry even if
 * they later add whitespace, uppercase the value, etc. — operational
 * predictability matters more than strict parsing.
 *
 * CI environments also implicitly opt out. The `CI` env var is set
 * to a truthy value by every major CI platform (GitHub Actions,
 * GitLab, CircleCI, Travis, Buildkite, etc.), and `CONTINUOUS_
 * INTEGRATION` covers a few older systems. Without this opt-out,
 * every `npm install @settlegrid/cli` triggered by a developer's CI
 * pipeline would fire `cli_install_started` — silently inflating the
 * funnel's CLI-install count with bot traffic and depressing the
 * downstream conversion rate. The CI opt-out is implicit (no user
 * action required) because asking every CI operator to set
 * `SETTLEGRID_TELEMETRY=0` is unrealistic.
 */
export function isOptedOut(): boolean {
  if (isCi()) return true
  const raw = process.env.SETTLEGRID_TELEMETRY?.trim().toLowerCase()
  if (!raw) return false
  return raw === '0' || raw === 'false' || raw === 'no' || raw === 'off'
}

/**
 * CI environment detection. `CI` is the de-facto-standard env var
 * across virtually every CI platform (Vercel, GitHub Actions, GitLab,
 * CircleCI, Travis, Buildkite, AppVeyor, Drone, etc.). Some older
 * systems set `CONTINUOUS_INTEGRATION` instead. We treat any truthy
 * value as a positive CI signal — including the literal string
 * `'false'`, which is intentional: a CI that exports `CI=false` is
 * still a CI environment (the value is conventionally just "true"
 * but the variable's PRESENCE is the load-bearing signal).
 */
function isCi(): boolean {
  return (
    process.env.CI !== undefined ||
    process.env.CONTINUOUS_INTEGRATION !== undefined
  )
}

/** Resolve the proxy base URL. Trailing slashes stripped. */
export function getProxyBase(): string {
  const raw = process.env.SETTLEGRID_API_URL?.trim()
  const base = raw && raw.length > 0 ? raw : DEFAULT_PROXY_BASE
  return base.replace(/\/$/, '')
}

// ─── distinct_id persistence ────────────────────────────────────────────────

/**
 * Path to the persistent telemetry-id file. Honours the standard
 * `HOME` env var via `os.homedir()`, with a fallback to the OS
 * tmpdir-equivalent only when `homedir()` returns an empty string
 * (a containerised environment with no home set). The fallback path
 * means we still get a stable-ish ID across invocations within the
 * same container, while never leaving an unwritable directory error
 * to surface as an exception.
 */
export function telemetryIdPath(): string {
  const home = homedir() || '/tmp'
  return path.join(home, '.settlegrid', 'telemetry-id')
}

/**
 * UUID v4 regex — guards against a corrupt / truncated file that
 * would otherwise produce an invalid distinct_id and noisy PostHog
 * data. If the file exists but doesn't parse, we regenerate.
 */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Read the persisted distinct_id, regenerating + persisting on first
 * run, missing file, or corrupt content. Never throws — on any
 * filesystem error we return an in-process UUID so telemetry still
 * works (just won't be stable across invocations).
 *
 * Browser → CLI handoff: `SETTLEGRID_POSTHOG_ID` env var, when set
 * to a valid UUID, overrides both the persisted file and any
 * generated id for this invocation. The gallery's Copy-Install-
 * Command button on /templates/<slug> embeds the browser's PostHog
 * distinct_id into the generated command so the postinstall hook
 * AND the `add` subcommand emit telemetry under the same id as the
 * preceding browser session — collapsing gallery_viewed,
 * template_detail_viewed, cli_install_started, and scaffold_success
 * onto a single PostHog person.
 *
 * The env var is NOT persisted to ~/.settlegrid/telemetry-id (a
 * borrowed browser id shouldn't pin the machine's identity for all
 * future invocations).
 */
export function getDistinctId(): string {
  const envId = process.env.SETTLEGRID_POSTHOG_ID?.trim()
  if (envId && UUID_RE.test(envId)) return envId

  const file = telemetryIdPath()
  try {
    const existing = readFileSync(file, 'utf8').trim()
    if (UUID_RE.test(existing)) return existing
  } catch {
    // file missing / unreadable — fall through to (re)create
  }

  const id = randomUUID()
  try {
    mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
    writeFileSync(file, id, { mode: 0o600 })
    // Hostile-review fix (H2): writeFileSync's `mode` only takes
    // effect when the file is created — if a corrupt file already
    // existed at world-readable perms (e.g. 0o644 from a prior
    // misconfigured tool), the regen leaves the looser mode in
    // place and the distinct_id leaks across users on the system.
    // Explicit chmodSync clamps to 0o600 regardless of prior state.
    chmodSync(file, 0o600)
  } catch {
    // Persistence failure — log nothing (postinstall must stay
    // silent), but still return the freshly generated ID so the
    // current invocation has a useful distinct_id.
  }
  return id
}

// ─── Capture ─────────────────────────────────────────────────────────────────

/**
 * Test-only override for the fetch implementation. Defaults to
 * `globalThis.fetch`. The CLI tests inject a mock that captures the
 * actual outbound POST body — the wire-shape integration test pattern.
 */
let fetchOverride: typeof fetch | undefined

/** @internal Test hook — DO NOT use from production code. */
export function __setFetchForTests(impl: typeof fetch | undefined): void {
  fetchOverride = impl
}

interface CaptureBody {
  event: CliEventName
  properties: Record<string, unknown>
  distinct_id: string
}

/**
 * POST a single CLI event to the proxy. Always resolves (never
 * throws / rejects). Returns `true` on a 2xx response, `false`
 * otherwise — callers can ignore the return value because telemetry
 * failures must not surface to the user.
 */
async function post(body: CaptureBody): Promise<boolean> {
  const fetchImpl = fetchOverride ?? globalThis.fetch
  if (typeof fetchImpl !== 'function') {
    // Node < 18 / unusual sandboxes — silently no-op rather than throw.
    return false
  }

  const url = `${getProxyBase()}/api/telemetry/capture`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TELEMETRY_TIMEOUT_MS)

  try {
    const res = await fetchImpl(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: controller.signal,
    })
    return res.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Capture a single event. Respects opt-out + adds the persistent
 * distinct_id. Fire-and-forget at the call site — callers should
 * not await this in critical paths.
 */
export async function capture<E extends CliEventName>(
  event: E,
  properties: Record<string, unknown>,
): Promise<boolean> {
  if (isOptedOut()) return false
  return post({
    event,
    properties,
    distinct_id: getDistinctId(),
  })
}

// ─── Convenience helpers (typed-property versions) ──────────────────────────

/**
 * Capture `cli_install_started`. Called from the postinstall hook.
 * `cli_version` is sourced from package.json by the caller (postinstall
 * has direct access). `node_version` and `os` are filled here.
 */
export async function captureCliInstallStarted(args: {
  cli_version: string
}): Promise<boolean> {
  return capture('cli_install_started', {
    cli_version: args.cli_version,
    node_version: process.versions.node,
    os: `${process.platform}-${process.arch}`,
  })
}

/** Capture `scaffold_success` after a `settlegrid add` run completes. */
export async function captureScaffoldSuccess(args: {
  template_slug: string
  duration_ms: number
}): Promise<boolean> {
  return capture('scaffold_success', {
    template_slug: args.template_slug,
    duration_ms: args.duration_ms,
  })
}

/** Capture `scaffold_failed` on any error path of `settlegrid add`. */
export async function captureScaffoldFailed(args: {
  template_slug: string
  error_code: ScaffoldErrorCode
}): Promise<boolean> {
  return capture('scaffold_failed', {
    template_slug: args.template_slug,
    error_code: args.error_code,
  })
}

// ─── Privacy normalisation ──────────────────────────────────────────────────

/**
 * Hostile-review fix (H3): forwarding the raw `source` string from
 * `settlegrid add <source>` to PostHog would leak the user's
 * filesystem layout for local-path invocations
 * (e.g. `/Users/me/code/secret-project`). Github URLs are public
 * coordinates and safe to log; local paths are anonymised; unknown
 * inputs collapse to '(unknown)'.
 *
 * Exported for unit tests + symmetry with the CLI's existing
 * `parseGithubRepo` helper.
 */
export function normalizeScaffoldSlug(source: string | undefined): string {
  if (!source) return '(unknown)'
  // Lightweight inline detection — we don't want to import the
  // `commands/add.ts` helpers from a module that's intended to be
  // dependency-free at the telemetry layer. The patterns mirror
  // `isGithubUrl` / `parseGithubRepo` in `lib/source-resolver.ts`
  // and `pr/github.ts`, kept narrow because we only need to
  // distinguish "github" vs "local" for privacy purposes.
  const githubLike =
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:[/#?].*)?$/i.exec(
      source,
    ) ??
    /^github:([^/\s]+)\/([^/\s]+)(?:[/#?].*)?$/i.exec(source) ??
    /^git@github\.com:([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i.exec(source)
  if (githubLike) {
    const owner = githubLike[1]
    const repo = githubLike[2].replace(/\.git$/i, '')
    return `github:${owner}/${repo}`
  }
  // Anything else (filesystem paths, unrecognised git hosts, etc.)
  // collapses to '(local)' — never the raw string. The funnel
  // doesn't lose meaningful signal: a private local path is just a
  // "user tried to scaffold something off the public registry."
  return '(local)'
}
