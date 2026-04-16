/**
 * Meilisearch client for gallery search.
 *
 * Uses the PUBLIC search-only key — safe for client bundles.
 * The master key is NEVER imported here.
 */

import { MeiliSearch, type SearchResponse } from 'meilisearch'
import type { TemplateManifest } from '@/lib/registry'
import { MEILI_URL, MEILI_SEARCH_KEY, SEARCH_ENABLED } from '@/env'

let client: MeiliSearch | null = null

function getClient(): MeiliSearch | null {
  if (client) return client
  if (!SEARCH_ENABLED) return null
  client = new MeiliSearch({ host: MEILI_URL, apiKey: MEILI_SEARCH_KEY })
  return client
}

export interface SearchFilters {
  category?: string
  tags?: string[]
}

export type TemplateSearchResult = SearchResponse<TemplateManifest>

/** Escape double quotes and backslashes in Meilisearch filter values. */
function escapeFilterValue(v: string): string {
  return v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * Sanitize Meilisearch highlight HTML — strip all tags except <mark>.
 * Prevents XSS if source data contains HTML characters.
 */
export function sanitizeHighlight(html: string): string {
  return html.replace(/<(?!\/?mark\s*>)[^>]*>/gi, '')
}

export async function searchTemplates(
  query: string,
  filters?: SearchFilters,
): Promise<TemplateSearchResult | null> {
  const c = getClient()
  if (!c) return null

  const filterParts: string[] = []
  if (filters?.category) {
    filterParts.push(`category = "${escapeFilterValue(filters.category)}"`)
  }
  if (filters?.tags && filters.tags.length > 0) {
    const tagFilters = filters.tags.map(
      (t) => `tags = "${escapeFilterValue(t)}"`,
    )
    filterParts.push(`(${tagFilters.join(' OR ')})`)
  }

  return c.index<TemplateManifest>('templates').search(query, {
    filter: filterParts.length > 0 ? filterParts.join(' AND ') : undefined,
    limit: 20,
    attributesToHighlight: ['name', 'description'],
    highlightPreTag: '<mark>',
    highlightPostTag: '</mark>',
  })
}
