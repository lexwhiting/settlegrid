/**
 * Type declarations for templater-categories.mjs.
 *
 * The runtime module is plain JS so it can be imported from .mjs (the file
 * generator at scripts/gen/core.mjs) without a build step. This companion
 * gives .ts consumers (backfill-p3-2-manifests.ts, scripts/__tests__) full
 * type fidelity under NodeNext + strict.
 */

export type GalleryCategory =
  | 'ai'
  | 'data'
  | 'devtools'
  | 'infra'
  | 'productivity'
  | 'finance'
  | 'commerce'
  | 'media'
  | 'research'
  | 'other'

export const GALLERY_CATEGORIES: readonly GalleryCategory[]

export const TEMPLATER_TO_GALLERY_CATEGORY: Readonly<
  Record<string, GalleryCategory>
>

export function mapCategory(
  templaterCategory: string | undefined | null,
): GalleryCategory
