/**
 * A route that calls notFound() must answer with HTTP 404, not a 200 page.
 *
 * A loading.tsx wraps its segment (and every segment below it) in a Suspense
 * boundary. Next.js then streams the loading fallback and sends the response
 * headers before the page finishes rendering, so a later notFound() can only
 * render the not-found UI; the status has already gone out as 200. Unknown or
 * removed /tools/<slug> pages answered 200 with the layout's "Showcase" title
 * for this reason.
 *
 * So: no root app/loading.tsx (it wraps every route), and no loading.tsx on
 * any segment at or above a page that calls notFound(). Pages that need a
 * loading state get a loading.tsx on their own segment, below any such page.
 *
 * Without the root boundary, a statically rendered page whose segment reads
 * useSearchParams() needs its own Suspense boundary (a segment loading.tsx,
 * a layout <Suspense>, or one in the page), or `next build` fails.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const APP_DIR = resolve(__dirname, '../app')

function findPages(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'api') continue
      out.push(...findPages(full))
    } else if (entry.name === 'page.tsx') {
      out.push(full)
    }
  }
  return out
}

const pagesCallingNotFound = findPages(APP_DIR)
  .filter((file) => /\bnotFound\(\s*\)/.test(readFileSync(file, 'utf8')))
  .map((file) => relative(APP_DIR, file))

/** Pages whose own segment directory has a file that calls useSearchParams(). */
const pagesReadingSearchParams = findPages(APP_DIR)
  .filter((file) =>
    readdirSync(dirname(file), { withFileTypes: true }).some(
      (e) => e.isFile() && /\.tsx?$/.test(e.name) && /\buseSearchParams\(/.test(readFileSync(join(dirname(file), e.name), 'utf8')),
    ),
  )
  .map((file) => relative(APP_DIR, file))

/** True when the page or a layout/loading file at or above it gives it a Suspense boundary. */
function hasSuspenseBoundary(pageRel: string): boolean {
  const page = join(APP_DIR, pageRel)
  if (/<Suspense\b/.test(readFileSync(page, 'utf8'))) return true
  let dir = dirname(page)
  for (;;) {
    if (existsSync(join(dir, 'loading.tsx'))) return true
    const layout = join(dir, 'layout.tsx')
    if (existsSync(layout) && /<Suspense\b/.test(readFileSync(layout, 'utf8'))) return true
    if (dir === APP_DIR) return false
    dir = dirname(dir)
  }
}

/** loading.tsx files from the page's own segment up to the app root. */
function loadingBoundariesAbove(pageRel: string): string[] {
  const found: string[] = []
  let dir = dirname(join(APP_DIR, pageRel))
  for (;;) {
    const loading = join(dir, 'loading.tsx')
    if (existsSync(loading)) found.push(relative(APP_DIR, loading))
    if (dir === APP_DIR) break
    dir = dirname(dir)
  }
  return found
}

describe('notFound() pages keep a 404 status', () => {
  it('has no root app/loading.tsx', () => {
    expect(existsSync(join(APP_DIR, 'loading.tsx'))).toBe(false)
  })

  it('finds the pages that call notFound()', () => {
    expect(pagesCallingNotFound).toContain(join('tools', '[slug]', 'page.tsx'))
  })

  it.each(pagesCallingNotFound)('%s has no loading.tsx at or above its segment', (pageRel) => {
    expect(loadingBoundariesAbove(pageRel)).toEqual([])
  })
})

describe('useSearchParams() pages keep a Suspense boundary', () => {
  it('finds the pages that read search params', () => {
    expect(pagesReadingSearchParams).toContain(join('start', 'page.tsx'))
  })

  it.each(pagesReadingSearchParams)('%s has a Suspense boundary', (pageRel) => {
    expect(hasSuspenseBoundary(pageRel)).toBe(true)
  })
})
