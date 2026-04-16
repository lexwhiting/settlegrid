/**
 * Environment variable declarations for the web app.
 * Feature flags and configuration read from process.env.
 */

/** Gallery feature flag — default off. Set NEXT_PUBLIC_GALLERY_ENABLED=true to enable. */
export const GALLERY_ENABLED =
  process.env.NEXT_PUBLIC_GALLERY_ENABLED === 'true'

/** Meilisearch public URL — search requests go here from the browser. */
export const MEILI_URL = process.env.NEXT_PUBLIC_MEILI_URL ?? ''

/** Meilisearch search-only key — safe for client bundles. */
export const MEILI_SEARCH_KEY = process.env.NEXT_PUBLIC_MEILI_SEARCH_KEY ?? ''

/** Whether Meilisearch search is configured and usable. */
export const SEARCH_ENABLED = !!(MEILI_URL && MEILI_SEARCH_KEY)
