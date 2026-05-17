/**
 * Gallery-template download for `create-settlegrid-tool --template <slug>`.
 *
 * The curated SettleGrid templates each live in a public repo at
 * `github.com/settlegrid/settlegrid-<slug>`. This module fetches one
 * of those repos as a tarball via giget — no `.git` history, a clean
 * starting point — into the target directory.
 *
 * This is distinct from the bundled-archetype scaffolder in
 * `scaffold.ts` (blank / rest-api / openapi / mcp-server), which
 * copies templates shipped INSIDE this package's own tarball.
 */
import fs from 'fs-extra'
import type { ScaffoldErrorCode } from './telemetry.js'

/** GitHub org + repo-name prefix that every gallery template uses. */
const GALLERY_OWNER = 'settlegrid'
const GALLERY_REPO_PREFIX = 'settlegrid-'

/** Reject slugs longer than this — registry slugs are short words. */
const MAX_SLUG_LEN = 64

/**
 * Gallery slugs are lowercase alphanumeric words joined by single
 * hyphens (`tmdb`, `api-football`, `flight-prices`). The pattern
 * forbids leading/trailing/double hyphens.
 */
const GALLERY_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Error carrying a machine-readable `ScaffoldErrorCode` so the CLI
 * orchestrator can map a failure straight to a `scaffold_failed`
 * telemetry event without re-classifying the message.
 */
export class ScaffoldError extends Error {
  readonly code: ScaffoldErrorCode

  constructor(code: ScaffoldErrorCode, message: string) {
    super(message)
    this.name = 'ScaffoldError'
    this.code = code
  }
}

/**
 * Validate a gallery slug.
 *
 * This is a SECURITY boundary, not just a niceness check: the slug is
 * interpolated into both a giget source
 * (`github:settlegrid/settlegrid-<slug>`) and the default target
 * directory name (`settlegrid-<slug>`). A slug containing `..` or `/`
 * would let a malicious gallery link write files outside the user's
 * cwd. The strict character class makes path traversal structurally
 * impossible.
 */
export function isValidGallerySlug(slug: string): boolean {
  return (
    slug.length > 0 &&
    slug.length <= MAX_SLUG_LEN &&
    GALLERY_SLUG_RE.test(slug)
  )
}

/** giget source spec for a gallery slug. */
export function gallerySource(slug: string): string {
  return `github:${GALLERY_OWNER}/${GALLERY_REPO_PREFIX}${slug}`
}

/** Default target directory name when the user doesn't pass one. */
export function defaultGalleryDir(slug: string): string {
  return `${GALLERY_REPO_PREFIX}${slug}`
}

/**
 * Classify a giget download failure into a telemetry error code.
 *
 *   - 404 / "not found"            → `template_not_found`
 *   - permission / disk-space      → `write_failed`
 *   - everything else (network,
 *     bad archive, DNS, timeout)   → `download_failed`
 */
export function classifyGigetError(err: unknown): ScaffoldErrorCode {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  if (msg.includes('404') || msg.includes('not found')) {
    return 'template_not_found'
  }
  if (
    msg.includes('eacces') ||
    msg.includes('eperm') ||
    msg.includes('erofs') ||
    msg.includes('enospc') ||
    msg.includes('eexist') ||
    msg.includes('permission denied')
  ) {
    return 'write_failed'
  }
  return 'download_failed'
}

/**
 * Download a gallery template into `targetDir`.
 *
 * Throws a {@link ScaffoldError} carrying a `ScaffoldErrorCode` on
 * every failure path:
 *   - invalid slug              → `template_not_found`
 *   - target dir already used   → `write_failed`
 *   - giget download failure    → classified via {@link classifyGigetError}
 */
export async function downloadGalleryTemplate(
  slug: string,
  targetDir: string,
): Promise<void> {
  if (!isValidGallerySlug(slug)) {
    throw new ScaffoldError(
      'template_not_found',
      slug.trim().length === 0
        ? 'Missing template slug. Usage: npx create-settlegrid-tool --template <slug>'
        : `Unknown or invalid template "${slug}". Slugs are lowercase letters, digits, and hyphens.`,
    )
  }

  // Refuse to scaffold into a non-empty directory — never clobber a
  // user's existing files. An absent or empty directory is fine.
  if (await fs.pathExists(targetDir)) {
    const entries = await fs.readdir(targetDir)
    if (entries.length > 0) {
      throw new ScaffoldError(
        'write_failed',
        `Directory "${targetDir}" already exists and is not empty.`,
      )
    }
  }

  try {
    // Dynamic import keeps giget out of the module graph for the
    // interactive (bundled-archetype) path and makes it trivial to
    // mock in tests.
    const { downloadTemplate } = await import('giget')
    await downloadTemplate(gallerySource(slug), {
      dir: targetDir,
      force: true,
    })
  } catch (err) {
    throw new ScaffoldError(
      classifyGigetError(err),
      err instanceof Error ? err.message : String(err),
    )
  }
}
