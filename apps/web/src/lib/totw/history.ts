/**
 * P5.4 — TOTW history file IO.
 *
 * `docs/content/totw-history.json` records every featured template:
 *
 *   [
 *     { "slug": "stripe", "featuredAt": "2026-05-12", "score": 47 },
 *     ...
 *   ]
 *
 * Writes are append-only and sorted by `featuredAt` ascending so a
 * git diff is readable across re-runs (the script never rewrites
 * past entries; idempotency comes from the dedup window, not from
 * removing entries).
 */

import { readFile, writeFile } from 'node:fs/promises'

export interface TotwHistoryEntry {
  slug: string
  /** Date of feature in YYYY-MM-DD format (local Monday of that week). */
  featuredAt: string
  /** Final score at selection time — useful for retro analysis. */
  score: number
}

/** Number of weeks a slug stays in the recency-block window. */
export const RECENCY_BLOCK_WEEKS = 8

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

/**
 * Parse a history file. Returns `[]` on missing-file, throws on
 * malformed JSON or schema-invalid entries (callers want to fail
 * loud here — silently dropping bad entries would let the script
 * re-feature a template after a corrupted history).
 */
export async function readHistory(path: string): Promise<TotwHistoryEntry[]> {
  let raw: string
  try {
    raw = await readFile(path, 'utf-8')
  } catch (err) {
    if (isNodeENOENT(err)) return []
    throw err
  }
  if (raw.trim() === '') return []
  const parsed = JSON.parse(raw)
  if (!Array.isArray(parsed)) {
    throw new Error(`History file ${path}: expected array, got ${typeof parsed}`)
  }
  for (const entry of parsed) {
    validateEntry(entry, path)
  }
  return parsed as TotwHistoryEntry[]
}

/**
 * Append an entry and write to disk. The file is rewritten as a
 * sorted-ascending JSON array with a trailing newline (deterministic
 * git diff). Caller is responsible for not appending the same slug
 * twice on the same date (the dedup helper covers normal cases).
 */
export async function appendHistory(
  path: string,
  entry: TotwHistoryEntry,
): Promise<TotwHistoryEntry[]> {
  validateEntry(entry, path)
  const existing = await readHistory(path)
  const next = [...existing, entry].sort((a, b) =>
    a.featuredAt.localeCompare(b.featuredAt),
  )
  await writeFile(path, JSON.stringify(next, null, 2) + '\n', 'utf-8')
  return next
}

/**
 * Return the set of slugs blocked from re-feature this week because
 * they appeared in the history within the recency window.
 *
 * `today` is passed in (not read from `Date.now()`) so the script and
 * tests can be deterministic about Monday-vs-Tuesday edge cases.
 */
export function recentlyFeaturedSlugs(
  history: ReadonlyArray<TotwHistoryEntry>,
  today: Date,
  windowWeeks: number = RECENCY_BLOCK_WEEKS,
): Set<string> {
  const cutoffMs = today.getTime() - windowWeeks * 7 * 24 * 60 * 60 * 1000
  const blocked = new Set<string>()
  for (const entry of history) {
    const entryMs = Date.parse(`${entry.featuredAt}T00:00:00Z`)
    if (Number.isFinite(entryMs) && entryMs >= cutoffMs) {
      blocked.add(entry.slug)
    }
  }
  return blocked
}

// ─── helpers ───────────────────────────────────────────────────────

function validateEntry(entry: unknown, path: string): void {
  if (!entry || typeof entry !== 'object') {
    throw new Error(`History file ${path}: entry is not an object`)
  }
  const e = entry as Record<string, unknown>
  if (typeof e.slug !== 'string' || e.slug.length === 0) {
    throw new Error(`History file ${path}: entry.slug must be non-empty string`)
  }
  if (typeof e.featuredAt !== 'string' || !DATE_REGEX.test(e.featuredAt)) {
    throw new Error(
      `History file ${path}: entry.featuredAt must be YYYY-MM-DD (got ${JSON.stringify(e.featuredAt)})`,
    )
  }
  if (typeof e.score !== 'number' || !Number.isFinite(e.score)) {
    throw new Error(`History file ${path}: entry.score must be finite number`)
  }
}

function isNodeENOENT(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: string }).code === 'ENOENT'
  )
}
