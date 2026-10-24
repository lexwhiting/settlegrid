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
