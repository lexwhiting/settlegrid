/**
 * Pure helper functions and types for the template registry.
 *
 * This file is safe to import from client components ('use client')
 * because it contains NO Node.js built-in imports (no node:fs, node:path).
 * The server-only getRegistry() function lives in registry.ts, which
 * re-exports everything from this file for backward compatibility.
 */

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

// ── Pure helpers (no filesystem dependency) ───────────────────────────────

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
