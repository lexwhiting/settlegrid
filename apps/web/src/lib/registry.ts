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
  return JSON.parse(readFileSync(filePath, 'utf-8'))
})

// ── Helpers ────────────────────────────────────────────────────────────────

export function getTemplateBySlug(
  registry: RegistryJson,
  slug: string,
): TemplateManifest | undefined {
  return registry.templates.find((t) => t.slug === slug)
}

export function listCategories(
  registry: RegistryJson,
): { name: string; count: number }[] {
  return Object.entries(registry.categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function listTags(
  registry: RegistryJson,
  category?: string,
): string[] {
  const templates = category
    ? registry.templates.filter((t) => t.category === category)
    : registry.templates
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
