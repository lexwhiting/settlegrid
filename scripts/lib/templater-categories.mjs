/**
 * Templater category → gallery category mapping (single source of truth).
 *
 * Two vocabularies coexist for "category":
 *
 *   - Templater slugs (in `data/templater/categories.json`) are
 *     fine-grained: `rag`, `vector-dbs`, `agent-frameworks`, `observability`,
 *     `synthetic-data`, … (20 today). The Templater pipeline + the scale-run
 *     orchestrator both work in this vocabulary.
 *   - Gallery-enum values (in `packages/mcp/src/template-schema.ts` →
 *     `templateManifestSchema.category`) are coarse: `ai | data | devtools |
 *     infra | productivity | finance | commerce | media | research | other`.
 *     The 97 published manifests + the registry-build's `--strict` gate
 *     speak this vocabulary.
 *
 * `mapCategory` projects a Templater slug onto its gallery-enum bucket,
 * falling back to `'other'` so an unmapped slug never crashes a build.
 *
 * Two consumers today:
 *   1. `scripts/gen/core.mjs` (the file generator) — calls `mapCategory()`
 *      to set `manifest.category` and uses the raw Templater slug as the
 *      manifest's first tag (matching the buildManifest convention).
 *   2. `scripts/template-audit/backfill-p3-2-manifests.ts` (historical
 *      backfill) — imports + re-exports the map so its public
 *      `mapCategory` export keeps the same shape its tests assert on.
 *
 * Plain JS (.mjs) so consumers in BOTH `.ts` (via NodeNext resolution of
 * `.mjs` extensions) and `.mjs` (relative import) work without a build
 * step. The TS consumers cast results to their local `GalleryCategory`
 * type alias.
 */

/**
 * @typedef {('ai'|'data'|'devtools'|'infra'|'productivity'|'finance'|'commerce'|'media'|'research'|'other')} GalleryCategory
 */

/** @type {readonly GalleryCategory[]} */
export const GALLERY_CATEGORIES = Object.freeze([
  'ai',
  'data',
  'devtools',
  'infra',
  'productivity',
  'finance',
  'commerce',
  'media',
  'research',
  'other',
])

/**
 * Templater slug → gallery enum.
 *
 * @type {Readonly<Record<string, GalleryCategory>>}
 */
export const TEMPLATER_TO_GALLERY_CATEGORY = Object.freeze({
  rag: 'ai',
  'vector-dbs': 'data',
  'agent-frameworks': 'ai',
  'llm-gateways': 'ai',
  'eval-tools': 'devtools',
  observability: 'devtools',
  'fine-tuning': 'ai',
  embeddings: 'ai',
  'image-gen': 'media',
  speech: 'media',
  translation: 'productivity',
  'code-analysis': 'devtools',
  scraping: 'data',
  'browser-automation': 'devtools',
  'data-pipelines': 'data',
  'document-intelligence': 'data',
  'knowledge-graphs': 'data',
  'prompt-engineering': 'ai',
  'synthetic-data': 'data',
  'ml-monitoring': 'devtools',
})

/**
 * Map a Templater slug to its gallery-enum value. Falls back to `'other'`
 * for absent / unrecognized inputs.
 *
 * @param {string | undefined | null} templaterCategory
 * @returns {GalleryCategory}
 */
export function mapCategory(templaterCategory) {
  if (typeof templaterCategory !== 'string' || templaterCategory.length === 0) {
    return 'other'
  }
  return TEMPLATER_TO_GALLERY_CATEGORY[templaterCategory] ?? 'other'
}
