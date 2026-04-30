/**
 * P2.MKT1 — helpers for the SettleGrid vs Nevermined comparison page.
 *
 * Extracted into their own module so the URL-safety logic + GitHub
 * URL shaping can be unit-tested directly (the page itself is a
 * server component and not reached by our test harness).
 */

const GH_REPO_BASE = 'https://github.com/lexwhiting/settlegrid'

/**
 * GitHub canonical URL shape differs for files vs directories:
 *   - /blob/<ref>/<path>  → single file view
 *   - /tree/<ref>/<path>  → directory view (or ref root)
 * Pass-through works for most paths thanks to GitHub redirects, but
 * the canonical form avoids redirects and is what users expect to
 * copy.
 */
const FILE_EXT_RE = /\.(ts|tsx|js|mjs|cjs|jsx|md|mdx|json|yml|yaml|toml|svg|sh)$/i

/**
 * Build a GitHub URL pointing at the given repo-relative path on the
 * default branch. Selects `/blob/` for files (detected via extension)
 * and `/tree/` for directories.
 */
export function gh(path: string): string {
  const clean = path.replace(/^\/+/, '')
  const kind = FILE_EXT_RE.test(clean) ? 'blob' : 'tree'
  return `${GH_REPO_BASE}/${kind}/main/${clean}`
}

/**
 * Safety net for `sourceUrl` values rendered as clickable links.
 * Accepts:
 *   - Internal routes: `/foo`, `/foo/bar` (single leading slash, not `//…`)
 *   - External http(s) URLs
 * Rejects:
 *   - undefined / empty
 *   - Protocol-relative URLs (`//evil.com`) — these render as
 *     cross-origin same-tab links and bypass target/rel safety
 *   - `javascript:`, `data:`, `file:`, and any other scheme
 *   - Malformed URLs (URL constructor throws)
 *
 * Callers should pass the result through this guard and fall back to
 * rendering the cite as plain text when it returns false.
 */
export function isSafeSourceUrl(url: string | undefined): url is string {
  if (!url) return false
  if (url.startsWith('//')) return false
  if (url.startsWith('/')) return true
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}
