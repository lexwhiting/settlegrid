/**
 * Developer profile slugs (settlegrid.ai/dev/{slug}).
 *
 * The format rules are shared with PATCH /api/dashboard/developer/profile.
 * `ensureDeveloperSlug` gives a developer without a slug (or display name)
 * one derived from their name or email, so the activation quality gate's
 * profile check can pass without a trip to Settings.
 */
import { eq, and, inArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { developers } from '@/lib/db/schema'
import { logger } from '@/lib/logger'
import { SYSTEM_DEVELOPER_SLUG, isSystemPrincipal } from '@/lib/system-principal'

export const DEVELOPER_SLUG_MIN_LENGTH = 3
export const DEVELOPER_SLUG_MAX_LENGTH = 30
export const DEVELOPER_SLUG_REGEX = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/

export const RESERVED_DEVELOPER_SLUGS: ReadonlySet<string> = new Set([
  'admin', 'api', 'settings', 'dashboard', 'login', 'register',
  'docs', 'tools', 'learn', 'faq', 'privacy', 'terms', 'support',
  'help', 'billing', 'pricing', 'about', 'contact', 'blog',
  'settlegrid', 'system', 'null', 'undefined', 'new',
])

const DISPLAY_NAME_MAX_LENGTH = 100
/** Numbered candidates tried before falling back to random suffixes. */
const NUMBERED_CANDIDATES = 5
const RANDOM_CANDIDATES = 3

export function isReservedDeveloperSlug(slug: string): boolean {
  return RESERVED_DEVELOPER_SLUGS.has(slug) || slug === SYSTEM_DEVELOPER_SLUG
}

/** Lowercase ASCII, hyphen-separated, at most DEVELOPER_SLUG_MAX_LENGTH chars. May be ''. */
export function slugifyDeveloperName(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, DEVELOPER_SLUG_MAX_LENGTH)
    .replace(/-+$/, '')
}

function isValidDeveloperSlug(slug: string): boolean {
  return (
    slug.length >= DEVELOPER_SLUG_MIN_LENGTH &&
    slug.length <= DEVELOPER_SLUG_MAX_LENGTH &&
    DEVELOPER_SLUG_REGEX.test(slug)
  )
}

function emailLocalPart(email: string): string {
  return email.split('@')[0]?.trim() ?? ''
}

function withSuffix(base: string, suffix: string): string {
  const head = base.slice(0, DEVELOPER_SLUG_MAX_LENGTH - suffix.length - 1).replace(/-+$/, '')
  return `${head}-${suffix}`
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 7).padEnd(5, '0')
}

/**
 * The base slug for a developer: the slugified name, else the slugified email
 * local part, else 'developer'. A valid but reserved base gets a '-dev' suffix.
 */
export function baseDeveloperSlug(name: string | null, email: string): string {
  const base =
    [name ?? '', emailLocalPart(email)].map(slugifyDeveloperName).find(isValidDeveloperSlug) ??
    'developer'
  return isReservedDeveloperSlug(base) ? withSuffix(base, 'dev') : base
}

/** Ordered candidates: base, base-2 … base-N, then random suffixes. */
export function developerSlugCandidates(base: string): string[] {
  const candidates = [base]
  for (let n = 2; n <= NUMBERED_CANDIDATES + 1; n++) candidates.push(withSuffix(base, String(n)))
  for (let i = 0; i < RANDOM_CANDIDATES; i++) candidates.push(withSuffix(base, randomSuffix()))
  return candidates.filter((c) => isValidDeveloperSlug(c) && !isReservedDeveloperSlug(c))
}

function isUniqueViolation(err: unknown): boolean {
  if (typeof err !== 'object' || err === null) return false
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code === '23505' || e.cause?.code === '23505'
}

/**
 * Give the developer a slug (and a display name) if they have none. Existing
 * values are never changed. Never throws: failures are logged and the current
 * values returned, so callers can run the quality gate regardless.
 */
export async function ensureDeveloperSlug(
  developerId: string,
): Promise<{ slug: string | null; name: string | null }> {
  try {
    const [dev] = await db
      .select({ name: developers.name, slug: developers.slug, email: developers.email })
      .from(developers)
      .where(eq(developers.id, developerId))
      .limit(1)
    if (!dev) return { slug: null, name: null }
    if (isSystemPrincipal(dev)) return { slug: dev.slug, name: dev.name }

    let name = dev.name
    if (!name || name.trim() === '') {
      const fallback = emailLocalPart(dev.email).slice(0, DISPLAY_NAME_MAX_LENGTH)
      if (fallback) {
        await db
          .update(developers)
          .set({ name: fallback, updatedAt: new Date() })
          .where(eq(developers.id, developerId))
        name = fallback
      }
    }

    if (dev.slug && dev.slug.trim() !== '') return { slug: dev.slug, name }

    const candidates = developerSlugCandidates(baseDeveloperSlug(name, dev.email))
    const taken = await db
      .select({ slug: developers.slug })
      .from(developers)
      .where(inArray(developers.slug, candidates))
    const takenSet = new Set(taken.map((row) => row.slug))

    for (const candidate of candidates) {
      if (takenSet.has(candidate)) continue
      try {
        const [updated] = await db
          .update(developers)
          .set({ slug: candidate, updatedAt: new Date() })
          .where(and(eq(developers.id, developerId), isNull(developers.slug)))
          .returning({ slug: developers.slug })
        if (updated) return { slug: updated.slug, name }

        // Another request set a slug first; keep theirs.
        const [current] = await db
          .select({ slug: developers.slug })
          .from(developers)
          .where(eq(developers.id, developerId))
          .limit(1)
        return { slug: current?.slug ?? null, name }
      } catch (err) {
        // Claimed by another developer since the lookup; try the next one.
        if (isUniqueViolation(err)) continue
        throw err
      }
    }

    logger.warn('developer_slug.no_free_candidate', { developerId })
    return { slug: null, name }
  } catch (err) {
    logger.error('developer_slug.ensure_failed', { developerId }, err)
    return { slug: null, name: null }
  }
}
