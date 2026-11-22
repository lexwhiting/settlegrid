/**
 * Source guard: no JS Date goes into a drizzle `sql` template as a parameter.
 *
 * In production, drizzle's postgres-js driver registers pass-through serializers
 * for the timestamp types, so a Date inside sql`…` reaches the wire unserialized and
 * the query throws (TypeError: The "string" argument must be of type string …
 * Received an instance of Date). pglite, used by the integration tests, accepts a
 * Date, so those tests can't catch it. Pass `${d.toISOString()}::timestamptz`, or
 * compare through a column (gte(table.createdAt, d)), whose mapper serializes it.
 *
 * The check is lexical: inside every sql`…` template it flags `${x}` where x is
 * declared in the same file as a Date (new Date(…) or a utc-periods helper without
 * .toISOString(), or typed `: Date`), and `${new Date(…)}`.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const SRC = path.resolve(__dirname, '../..')

const DATE_DECL = /(?:const|let|var)\s+(\w+)\s*(?::\s*Date\s*)?=\s*(?:new Date\(|utc(?:Day|Month|NextMonth)Start\(|daysBefore\(|hoursBefore\()([^\n]*)/g
const DATE_TYPED = /\b(\w+)\s*\??:\s*Date\b(?!\s*\|)/g
const SQL_OPEN = /\bsql(?:<[^`>]*(?:<[^`>]*>[^`>]*)*>)?`/g

/** The `${…}` expressions at the top level of the template starting at `start` (just after the backtick). */
function templateExpressions(src: string, start: number): string[] {
  const exprs: string[] = []
  let i = start
  while (i < src.length && src[i] !== '`') {
    if (src[i] === '\\') { i += 2; continue }
    if (src[i] === '$' && src[i + 1] === '{') {
      let depth = 1
      let j = i + 2
      while (j < src.length && depth > 0) {
        const c = src[j]
        if (c === '`') { // nested template: skip it whole
          j++
          while (j < src.length && src[j] !== '`') {
            if (src[j] === '\\') j++
            else if (src[j] === '$' && src[j + 1] === '{') {
              let d = 1; j += 2
              while (j < src.length && d > 0) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++ }
              continue
            }
            j++
          }
        } else if (c === '{') depth++
        else if (c === '}') depth--
        j++
      }
      exprs.push(src.slice(i + 2, j - 1))
      i = j
      continue
    }
    i++
  }
  return exprs
}

function findRawDateParams(src: string): string[] {
  const dates = new Set<string>()
  for (const m of src.matchAll(DATE_DECL)) {
    if (!/^[^;]*\.toISOString\(\)/.test(m[2])) dates.add(m[1])
  }
  for (const m of src.matchAll(DATE_TYPED)) dates.add(m[1])
  const hits: string[] = []
  for (const m of src.matchAll(SQL_OPEN)) {
    const line = src.slice(0, m.index).split('\n').length
    for (const e of templateExpressions(src, m.index! + m[0].length)) {
      const expr = e.trim()
      if ((/^\w+$/.test(expr) && dates.has(expr)) || /^new Date\(/.test(expr) && !/\.toISOString\(\)$/.test(expr)) {
        hits.push(`${line}: \${${expr}}`)
      }
    }
  }
  return hits
}

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue
      out.push(...sourceFiles(p))
    } else if (/\.tsx?$/.test(name) && !/\.(test|spec)\.tsx?$|\.d\.ts$/.test(name)) {
      out.push(p)
    }
  }
  return out
}

describe('no JS Date inside a sql template (source guard)', () => {
  it('finds none in the app source', () => {
    const offenders = sourceFiles(SRC).flatMap((f) =>
      findRawDateParams(readFileSync(f, 'utf8')).map((h) => `${path.relative(SRC, f)}:${h}`),
    )
    expect(offenders).toEqual([])
  })

  it('flags a Date variable or new Date() in a template, not ISO strings or column comparisons', () => {
    const bad = [
      'const since = new Date(Date.now() - 1000)\nsql`created_at >= ${since}`',
      'const start = utcMonthStart(now)\ndb.select({ n: sql<number>`count(*) filter (where ${t.at} >= ${start})` })',
      'function f(from: Date) { return sql`${t.at} < ${from}` }',
      'sql`${t.at} >= ${new Date()}`',
      'const a = new Date()\nsql`x in (select 1 where ${sql`${t.at} > ${a}`})`',
    ]
    for (const src of bad) expect(findRawDateParams(src), src).toHaveLength(1)
    const good = [
      'const since = new Date(Date.now() - 1000)\nsql`created_at >= ${since.toISOString()}::timestamptz`',
      'const iso = new Date(Date.now() - 1000).toISOString()\nsql`created_at >= ${iso}::timestamptz`',
      'const since = new Date()\nwhere(gte(t.createdAt, since))',
      'const since = new Date()\nsql`${t.id} = ${devId}`',
    ]
    for (const src of good) expect(findRawDateParams(src), src).toEqual([])
  })
})
