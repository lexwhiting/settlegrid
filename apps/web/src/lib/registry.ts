/**
 * Typed registry reader — reads apps/web/public/registry.json at build
 * time and provides helper functions for the gallery pages.
 *
 * Server-side only (uses node:fs). Wrapped in React cache() for
 * request deduplication during SSG.
 */

import { cache } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── Types ──────────────────────────────────────────────────────────────────

export interface TemplateManifest {
  slug: string
  name: string
  description: string
  version: string
  category: string
  tags: string[]
  author: { name: string; url?: string; github?: string }
  repo: { type: 'git'; url: string; directory?: string }
  runtime: string
  languages: string[]
  entry: string
  pricing: { model: string; perCallUsdCents?: number; currency: string }
  quality: { tests: boolean; ciPassing?: boolean; lastVerifiedAt?: string }
  capabilities: string[]
  screenshots?: { url: string; alt: string }[]
  loomUrl?: string
  deployButton?: { provider: string; url: string }
  featured: boolean
  trendingRank?: number
}

export interface RegistryJson {
  version: number
  generatedAt: string
  commit: string
  totalTemplates: number
  categories: Record<string, number>
  templates: TemplateManifest[]
}

// ── Reader ─────────────────────────────────────────────────────────────────

export const getRegistry = cache((): RegistryJson => {
  const filePath = join(process.cwd(), 'public', 'registry.json')
  const registry: RegistryJson = JSON.parse(readFileSync(filePath, 'utf-8'))
  if (registry.templates.length === 0) {
    throw new Error(
      'registry.json has 0 templates — run `npm run build:registry` before building the web app',
    )
  }
  return registry
})

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Spec API: `getTemplateBySlug(slug)` — calls getRegistry() internally.
 * Pass an explicit registry for testing without filesystem dependency.
 */
export function getTemplateBySlug(
  slug: string,
  registry?: RegistryJson,
): TemplateManifest | undefined {
  const reg = registry ?? getRegistry()
  return reg.templates.find((t) => t.slug === slug)
}

/**
 * Spec API: `listCategories()` — calls getRegistry() internally.
 */
export function listCategories(
  registry?: RegistryJson,
): { name: string; count: number }[] {
  const reg = registry ?? getRegistry()
  return Object.entries(reg.categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

/**
 * Spec API: `listTags(category?)` — calls getRegistry() internally.
 */
export function listTags(
  category?: string,
  registry?: RegistryJson,
): string[] {
  const reg = registry ?? getRegistry()
  const templates = category
    ? reg.templates.filter((t) => t.category === category)
    : reg.templates
  const tagSet = new Set<string>()
  for (const t of templates) {
    for (const tag of t.tags) {
      tagSet.add(tag)
    }
  }
  return [...tagSet].sort()
}

export function sortTemplates(
  templates: TemplateManifest[],
): TemplateManifest[] {
  return [...templates].sort((a, b) => {
    // trendingRank ascending (lower = better), missing ranks go last
    const aRank = a.trendingRank ?? Infinity
    const bRank = b.trendingRank ?? Infinity
    if (aRank !== bRank) return aRank - bRank
    return a.name.localeCompare(b.name)
  })
}

export function filterTemplates(
  templates: TemplateManifest[],
  opts: { category?: string; tags?: string[] },
): TemplateManifest[] {
  let result = templates
  if (opts.category) {
    result = result.filter((t) => t.category === opts.category)
  }
  if (opts.tags && opts.tags.length > 0) {
    const tagSet = new Set(opts.tags)
    result = result.filter((t) => t.tags.some((tag) => tagSet.has(tag)))
  }
  return result
}
