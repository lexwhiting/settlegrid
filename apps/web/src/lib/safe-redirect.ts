/**
 * Single source of truth for validating user-controlled redirect targets
 * (launch-gate G2-3 — open redirect). Used by every surface that turns an
 * untrusted value (a `?next` / `?redirect` query param, a server-supplied URL)
 * into a navigation, so the same-origin rule cannot drift between call sites.
 *
 * A value is a SAFE same-origin path only if it is a single leading slash
 * followed by a path — NOT protocol-relative (`//evil.com`), NOT a
 * backslash-escaped variant (`/\evil.com`, which browsers normalize toward
 * `//`), and NOT something the browser would treat as an absolute/authority
 * URL (`@evil.com`, `.evil.com`, `https://evil.com` — none start with `/`).
 *
 * The three `startsWith` clauses are the load-bearing guard. Rejecting any
 * control character (code point < 32) is defense-in-depth: a leading control
 * char already fails `startsWith('/')`, and rejecting embedded ones blocks
 * CRLF header-injection into a redirect `Location`.
 */

/** True iff `raw` is a same-origin relative path safe to navigate to. */
export function isSafeRelativePath(raw: string | null | undefined): raw is string {
  if (typeof raw !== 'string' || raw.length === 0) return false
  if (!raw.startsWith('/')) return false // must be a relative path
  if (raw.startsWith('//')) return false // protocol-relative → cross-origin
  if (raw.startsWith('/\\')) return false // backslash → browsers treat as `//`
  for (let i = 0; i < raw.length; i++) {
    if (raw.charCodeAt(i) < 32) return false // control chars (incl. CR/LF/TAB)
  }
  return true
}

/**
 * Return `raw` when it is a safe same-origin path, else `fallback`.
 * `fallback` MUST be a trusted in-app path (defaults to `/dashboard`).
 */
export function safeRelativePath(
  raw: string | null | undefined,
  fallback = '/dashboard',
): string {
  return isSafeRelativePath(raw) ? raw : fallback
}
