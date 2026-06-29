/**
 * Safe JSON-LD serializer for `<script type="application/ld+json">` payloads.
 *
 * `JSON.stringify` does not escape `</script>` — an object whose values
 * contain a literal `</script>` sequence would break out of the script tag
 * and render the remainder of the JSON as HTML (stored XSS, since CSP is
 * `script-src 'unsafe-inline'` — see `middleware.ts`). Escaping every `<` to
 * its unicode form `<` preserves JSON parsing (JSON parsers treat the
 * escape identically) while making it impossible to close the script tag via
 * the serialized payload.
 *
 * `<`-only escaping is provably sufficient: the HTML tokenizer ends a
 * `<script>` only on a literal `</script` (case-insensitively), and the
 * `<!--` / `<script` script-data states also require a literal `<`; removing
 * every `<` neutralizes every breakout. `application/ld+json` is parsed as
 * DATA (never executed), so U+2028/U+2029 need not be escaped.
 *
 * This is the single source of truth for the escape — it is the same
 * mitigation React's server-rendering docs recommend, and matches the
 * codebase precedent established at `learn/academy/[slug]/page.tsx`. Do NOT
 * substitute a literal `<` (a no-op) or the HTML entity `&lt;` (corrupts the
 * JSON-LD round-trip).
 *
 * @example
 *   <script
 *     type="application/ld+json"
 *     dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLdObject) }}
 *   />
 */
export function safeJsonLd(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, '\\u003c')
}
