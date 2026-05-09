/**
 * P5.4 — Splice helpers for the auto-generated TOTW post manifest.
 *
 * `apps/web/src/lib/blog-bodies/totw/registered.ts` contains
 * BEGIN/END comment markers that delimit two regions:
 *
 *   // TOTW_IMPORTS_BEGIN
 *   // <new import lines inserted before TOTW_IMPORTS_END>
 *   // TOTW_IMPORTS_END
 *   ...
 *   export const TOTW_POSTS: BlogPost[] = [
 *     // TOTW_ENTRIES_BEGIN
 *     // <new entry blocks inserted before TOTW_ENTRIES_END>
 *     // TOTW_ENTRIES_END
 *   ]
 *
 * `spliceRegisteredText` is the pure (input → output) string
 * transformation that produces the next manifest content. The script
 * (`scripts/template-of-the-week.ts`) reads + writes the file; this
 * module contains no IO so the splice logic is unit-testable in
 * isolation (and any future Turbopack build edge case in the script's
 * own ts-runner is decoupled from the splice correctness).
 */

export const IMPORTS_BEGIN = '// TOTW_IMPORTS_BEGIN'
export const IMPORTS_END = '// TOTW_IMPORTS_END'
export const ENTRIES_BEGIN = '// TOTW_ENTRIES_BEGIN'
export const ENTRIES_END = '// TOTW_ENTRIES_END'

export interface SplicePayload {
  importBinding: string
  bodyFilename: string
  postSlug: string
  templateName: string
  templateSlug: string
  date: string
  wordCount: number
}

/**
 * Splice a single TOTW entry into the registered.ts source. Pure —
 * input is the current source, output is the next source. Throws if
 * either marker is missing (catches the half-spliced failure mode
 * where one marker survived an operator edit and the other didn't).
 */
export function spliceRegisteredText(
  currentSource: string,
  payload: SplicePayload,
): string {
  const importLine = `import ${payload.importBinding} from './${payload.bodyFilename}'`
  const entryBlock = renderEntryBlock(payload)

  const afterImport = insertBefore(currentSource, IMPORTS_END, importLine + '\n')
  if (afterImport === currentSource) {
    throw new Error(
      `Marker ${IMPORTS_END} not found in registered.ts source. Restore the BEGIN/END comment markers before re-running.`,
    )
  }

  const afterEntry = insertBefore(afterImport, ENTRIES_END, entryBlock + '\n')
  if (afterEntry === afterImport) {
    throw new Error(
      `Marker ${ENTRIES_END} not found in registered.ts source. Restore the BEGIN/END comment markers before re-running.`,
    )
  }

  return afterEntry
}

/**
 * Render a single TOTW entry as a TS object literal block. Output is
 * indented 2 spaces because it sits inside `export const TOTW_POSTS:
 * BlogPost[] = [ ... ]`. Trailing comma + newline are added by the
 * splicer — this function returns the block without them.
 */
export function renderEntryBlock(p: SplicePayload): string {
  const escapedTitle = escapeForTsString(`${p.templateName} — Template of the Week`)
  const escapedDescription = escapeForTsString(
    `Why ${p.templateName} caught our eye this week — what it does, the minimal setup, and the angle that makes it worth a paragraph today.`,
  )
  // Reading-time at 240 wpm rounded up to nearest minute (matches the
  // existing blog posts' conventions).
  const readingMin = Math.max(1, Math.ceil(p.wordCount / 240))
  return [
    `  {`,
    `    slug: '${p.postSlug}',`,
    `    title: ${escapedTitle},`,
    `    description: ${escapedDescription},`,
    `    datePublished: '${p.date}',`,
    `    dateModified: '${p.date}',`,
    `    keywords: [`,
    `      'SettleGrid template',`,
    `      'MCP server',`,
    `      'template of the week',`,
    `      ${escapeForTsString(p.templateName)},`,
    `    ],`,
    `    readingTime: '${readingMin} min read',`,
    `    wordCount: ${p.wordCount},`,
    `    author: {`,
    `      name: 'Lex Whiting',`,
    `      url: 'https://x.com/lexwhiting',`,
    `      bio: 'Founder, SettleGrid. Bootstrapping a settlement layer for the AI economy.',`,
    `    },`,
    `    relatedSlugs: ['settlegrid-templates-launch'],`,
    `    body: ${p.importBinding},`,
    `    published: false,`,
    `  },`,
  ].join('\n')
}

/**
 * Escape an arbitrary string for embedding inside a single-quoted TS
 * string literal. Order matters: backslash first (so it doesn't
 * double-escape the escapes added after), then quotes, then line
 * terminators (which would otherwise break the literal). U+2028 /
 * U+2029 don't need escaping at modern TS targets (ES2019+ allows
 * them as literal characters); Next.js builds at ES2022.
 */
export function escapeForTsString(s: string): string {
  const escaped = s
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'")
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

/**
 * Insert `payload` just before the first occurrence of `marker` in
 * `haystack`. Returns the original string when `marker` is absent —
 * callers that want to fail loud must compare the result against the
 * input.
 */
export function insertBefore(
  haystack: string,
  marker: string,
  payload: string,
): string {
  const idx = haystack.indexOf(marker)
  if (idx === -1) return haystack
  return haystack.slice(0, idx) + payload + haystack.slice(idx)
}
