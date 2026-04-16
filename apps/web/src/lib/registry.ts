/**
 * Typed registry reader — reads apps/web/public/registry.json at build
 * time and provides helper functions for the gallery pages.
 *
 * SERVER-SIDE ONLY (uses node:fs). Do NOT import this file from 'use
 * client' components — import from '@/lib/registry-helpers' instead,
 * which exports the pure helper functions (sortTemplates, filterTemplates)
 * and types without any Node.js built-in dependencies.
 *
 * Wrapped in React cache() for request deduplication during SSG.
 */

import { cache } from 'react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Re-export types and pure helpers from the client-safe module so
// existing server-side imports (`from '@/lib/registry'`) keep working.
export type { TemplateManifest, RegistryJson } from './registry-helpers'
export { sortTemplates, filterTemplates } from './registry-helpers'

import type { RegistryJson, TemplateManifest } from './registry-helpers'

// ── Reader ─────────────────────────────────────────────────────────────────

export const getRegistry = cache((): RegistryJson => {
  const filePath = join(process.cwd(), 'public', 'registry.json')
  const registry: RegistryJson = JSON.parse(readFileSync(filePath, 'utf-8'))
  if (!Array.isArray(registry.templates) || registry.templates.length === 0) {
    throw new Error(
      'registry.json has 0 templates or is malformed — run `npm run build:registry` before building the web app',
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

// sortTemplates and filterTemplates are re-exported from registry-helpers.ts above.
