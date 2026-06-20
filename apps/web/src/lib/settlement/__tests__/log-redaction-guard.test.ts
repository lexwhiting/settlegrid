/**
 * V-N3-log-redaction — the COMPLETENESS grep-guard (handoff §8/§9; the durable
 * DC-16 anti-regression). It is a CALL-SPAN scan, NOT a line/file regex: for each
 * logger-shaped call it balance-scans delimiters to the matching close paren,
 * then within that argument span FAILS if any forbidden payer key (`operationId|
 * operation_id|from|nonce|payer|payerAddress|payerIdentifier|invocationId|
 * operationIds|drainNonce`) appears either as a bare shorthand (`{ operationId }`
 * — always raw) or as an object KEY bound to a value NOT in the redaction
 * ALLOW-LIST (`redactOpId(`/`settlementEntryId(`/`redactLogString(`/a sanctioned
 * PK read `id`/`row.id`/`rowId`/a `.map(…)` over those).
 *
 * ② HARDENING (seal-review H2/M2) — the original scan was blind to the exact
 * class that leaked:
 *   - **Call detection** now matches ALIASED / wrapped loggers
 *     (`\b\w*[Ll]ogger\.(info|warn|error)` → `appLogger.info(`, `this.logger.warn(`)
 *     AND the COMPUTED/dynamic form (`logger['error'](`, `logger[cond ? 'error'
 *     : 'warn'](`) — not just a bare `logger.`.
 *   - **Key detection** now flags QUOTED (`'operationId':`) and COMPUTED
 *     (`['operationId']:`) object keys, not just bare `operationId:`.
 *   - **Provenance allow** — the `…Id` auto-allow is tightened to the sanctioned
 *     PK reads only (`id` / `row.id` / `rowId`); a raw op_id parked in an
 *     arbitrary `…Id`-suffixed var (`someId`, `hopId`) no longer passes by NAME.
 *   - The key set adds `payerAddress` + `drainNonce` (the M1 adapter keys), so the
 *     guard forbids the SAME set the sanitizing-`appLogger` seam strips.
 *
 * Scope: `apps/web/src/**` excluding tests/.d.ts. The `packages/mcp` adapter log
 * sites are deliberately NOT walked — redacting inside the SDK would wrongly strip
 * a self-hoster's own logs; they are closed at runtime by the sanitizing-
 * `appLogger` seam (`@/lib/sanitizing-adapter-logger`), which IS in scope here and
 * is verified leak-free by this same scan.
 *
 * ② RE-REVIEW #2 follow-ups (seal-review-2) — decisions RECORDED here:
 *   - **B4 [FIXED]** — `channelId` + `channelAddress` (the raw drain channel
 *     contract address `0x<40>`) added to {@link FORBIDDEN}; the seam strips them.
 *   - **B7 [FIXED]** — the dotted `.id` provenance allow is tightened to a known
 *     PK-source row binding (`row`/`current`/`existing`); see {@link isAllowedValue}.
 *   - **B6 [DOCUMENTED — LATENT]** — the call-span lexer ({@link matchClose} /
 *     {@link captureValue}) does NOT recognize a REGEX LITERAL: a `)` inside a
 *     regex char-class/group closes the span early (a forbidden key AFTER it is
 *     silently missed) and an unbalanced `(` triggers a `<RUNAWAY-PARSE>`. NO live
 *     logger call passes a regex argument (verified by the green real-file scan +
 *     manual review), so this is latent; the runtime seam + `emit()` sanitizer are
 *     the real defenses. Pinned by self-tests below so a regression — or a future
 *     fix that adds regex recognition — is visible. (Adding a regex/division
 *     disambiguator to a hand lexer already certified for its current behavior was
 *     judged higher-risk than this documented latent gap.)
 *   - **B8 [DOCUMENTED — LATENT]** — call detection covers `*[Ll]ogger.(info|warn|
 *     error)` (dot + aliased `appLogger`/`this.logger`) and the computed
 *     `logger['level'](…)` form, but NOT: an alias not ending in `logger`
 *     (`const l = logger; l.error(…)`), a destructured method (`const { error } =
 *     logger`), a deeper member chain (`svc.log.error(…)`), or a SPREAD into the
 *     meta (`{ ...bag }` — the guard reads literal KEYS, not a spread source's
 *     contents). Zero live offending sites (verified — the logger is only ever
 *     called as `logger.`/`appLogger.`/`this.logger.`, and live spread sources
 *     carry only numeric counts). The spread limitation is pinned below.
 *
 * The allow-LIST (not a deny-list) is what lets it catch the `{ operationId: op }`
 * alias — a forbidden key bound to a raw variable fails because the variable is
 * not an allow-listed redaction. The scan is self-tested below (RED on synthetic
 * raw sites incl. shorthand, the `invocationId` key, an `operationIds` array, and
 * each new aliased/quoted/computed/dynamic form; GREEN on the redacted forms and
 * the seam), and the real-file file list is asserted non-empty (DC-05 non-vacuity).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC_ROOT = join(__dirname, '..', '..', '..') // apps/web/src

const FORBIDDEN = [
  'operationId',
  'operation_id',
  'from',
  'nonce',
  'payer',
  'payerAddress',
  'payerIdentifier',
  'invocationId',
  'operationIds',
  'drainNonce',
  'channelId', // B4: the raw drain channel contract address (0x<40>) — stripped at the seam
  'channelAddress',
] as const

/**
 * DOCUMENTED benign exceptions — NON-settlement logger events whose `from` key is
 * a verified non-payer value (a tier enum / a numeric pagination offset), keyed
 * on `${msg}::${key}` so a NEW raw `from:` in ANY other event still fails. Each is
 * provably not an EVM address. (The guard stays repo-wide + fully active for every
 * payer-bearing key; this list only exempts these three audited sites.)
 */
const BENIGN: ReadonlySet<string> = new Set([
  'billing.change_plan.success::from', // from: developer.tier — the prior plan tier (enum), not PII
  'crawler.npm.query_completed::from', // from: currentWithinOffset — a numeric pagination offset
  'crawler.npm_ai.query_completed::from', // from: currentWithinOffset — a numeric pagination offset
])

/** Walk the source tree, excluding tests, declarations, and node_modules. */
function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) sourceFiles(p, out)
    else if (/\.(ts|tsx)$/.test(p) && !/\.test\.tsx?$/.test(p) && !/\.d\.ts$/.test(p)) out.push(p)
  }
  return out
}

/**
 * From the index of a call's open `(`, return the index of the matching close
 * `)`, correctly skipping string/template-raw/comment content and counting parens
 * only in code position (incl. inside `${…}` template expressions). Returns -1 on
 * a runaway (unbalanced) scan.
 */
function matchClose(s: string, openIdx: number): number {
  let depth = 1
  let i = openIdx + 1
  const stack: Array<{ t: 'template' } | { t: 'expr'; brace: number }> = []
  while (i < s.length) {
    const top = stack[stack.length - 1]
    const c = s[i]
    if (top && top.t === 'template') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); i++; continue }
      if (c === '$' && s[i + 1] === '{') { stack.push({ t: 'expr', brace: 0 }); i += 2; continue }
      i++; continue
    }
    if (c === '/' && s[i + 1] === '/') { const nl = s.indexOf('\n', i); i = nl === -1 ? s.length : nl + 1; continue }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); i = e === -1 ? s.length : e + 2; continue }
    if (c === '\'' || c === '"') {
      const q = c; i++
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 2; else i++ }
      i++; continue
    }
    if (c === '`') { stack.push({ t: 'template' }); i++; continue }
    if (c === '{') { if (top && top.t === 'expr') top.brace++; i++; continue }
    if (c === '}') { if (top && top.t === 'expr') { if (top.brace === 0) { stack.pop(); i++; continue } top.brace-- } i++; continue }
    if (c === '(') { depth++; i++; continue }
    if (c === ')') { depth--; if (depth === 0) return i; i++; continue }
    i++
  }
  return -1
}

/**
 * From the index of an open `[`, return the index of the matching `]`, skipping
 * string content and counting nested brackets. Used to read the index expression
 * of a COMPUTED logger call (`logger['error']` / `logger[cond ? 'error' : 'warn']`).
 * Returns -1 on a runaway scan.
 */
function matchBracket(s: string, openIdx: number): number {
  let depth = 1
  let i = openIdx + 1
  while (i < s.length) {
    const c = s[i]
    if (c === '\'' || c === '"' || c === '`') {
      const q = c; i++
      while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 2; else i++ }
      i++; continue
    }
    if (c === '[') { depth++; i++; continue }
    if (c === ']') { depth--; if (depth === 0) return i; i++; continue }
    i++
  }
  return -1
}

/**
 * Find the open-paren index of every logger-shaped call in a source string —
 * both the DOT form (`\b\w*[Ll]ogger.(info|warn|error)(` → `logger.`, `appLogger.`,
 * `this.logger.`) and the COMPUTED form (`\b\w*[Ll]ogger[ … ](` whose bracket
 * holds a quoted `info|warn|error`, incl. a ternary). De-duplicated + sorted.
 */
function loggerCallOpens(content: string): number[] {
  const opens = new Set<number>()
  const dotRe = /\b\w*[Ll]ogger\s*\.\s*(?:info|warn|error)\s*\(/g
  let m: RegExpExecArray | null
  while ((m = dotRe.exec(content))) opens.add(m.index + m[0].length - 1)
  const brkRe = /\b\w*[Ll]ogger\s*\[/g
  while ((m = brkRe.exec(content))) {
    const lb = m.index + m[0].length - 1 // index of '['
    const rb = matchBracket(content, lb)
    if (rb === -1) continue
    const inner = content.slice(lb + 1, rb)
    if (!/(['"])(?:info|warn|error)\1/.test(inner)) continue // not a level access
    let n = rb + 1
    while (n < content.length && /\s/.test(content[n])) n++
    if (content[n] === '(') opens.add(n)
  }
  return [...opens].sort((a, b) => a - b)
}

/** Extract the first string-literal argument (the event `msg`) from a call span,
 *  or null if it is not a plain quoted string (e.g. a template literal). */
function firstStringArg(span: string): string | null {
  let i = 1 // skip '('
  while (i < span.length && /\s/.test(span[i])) i++
  const q = span[i]
  if (q !== '\'' && q !== '"') return null
  i++
  let out = ''
  while (i < span.length && span[i] !== q) {
    if (span[i] === '\\') { out += span[i + 1]; i += 2; continue }
    out += span[i]; i++
  }
  return out
}

/** Capture the value expression bound to a `key:` starting just after the colon,
 *  stopping at the top-level `,` / `}` / `)` (respecting nesting + strings). */
function captureValue(s: string, colonIdx: number): string {
  let i = colonIdx + 1
  const start = i
  let paren = 0, brace = 0, bracket = 0
  const stack: Array<{ t: 'template' } | { t: 'expr'; brace: number }> = []
  while (i < s.length) {
    const top = stack[stack.length - 1]
    const c = s[i]
    if (top && top.t === 'template') {
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); i++; continue }
      if (c === '$' && s[i + 1] === '{') { stack.push({ t: 'expr', brace: 0 }); i += 2; continue }
      i++; continue
    }
    if (c === '\'' || c === '"') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 2; else i++ } i++; continue }
    if (c === '`') { stack.push({ t: 'template' }); i++; continue }
    if (paren === 0 && brace === 0 && bracket === 0 && !top && (c === ',' || c === '}' || c === ')')) break
    if (c === '(') paren++
    else if (c === ')') paren--
    else if (c === '[') bracket++
    else if (c === ']') bracket--
    else if (c === '{') { if (top && top.t === 'expr') top.brace++; else brace++ }
    else if (c === '}') { if (top && top.t === 'expr') { if (top.brace === 0) { stack.pop(); i++; continue } top.brace-- } else brace-- }
    i++
  }
  return s.slice(start, i).trim()
}

/**
 * The settlement-ROW bindings whose `.id` IS the de-identified PK (§6.A: the
 * `findSettlementRow`/expiry-candidate row objects). Only a `.id` read off ONE of
 * these is a sanctioned dotted provenance — see {@link isAllowedValue} (B7).
 */
const PK_ROW_BINDINGS: ReadonlySet<string> = new Set(['row', 'current', 'existing'])

/** Is a `key:` value an allow-listed redaction? */
function isAllowedValue(value: string): boolean {
  const v = value.trim()
  if (/^redactOpId\s*\(/.test(v)) return true
  if (/^settlementEntryId\s*\(/.test(v)) return true
  if (/^redactLogString\s*\(/.test(v)) return true
  // A SANCTIONED PK read — PROVENANCE, not name-shape (B7). The de-identified PK
  // is the bare column `id` or the `rowId` param (reconcile.ts); the ONLY
  // sanctioned DOTTED form is `<rowBinding>.id` off a known settlement-row object
  // (`row`/`current`/`existing`). The prior rule auto-allowed ANY dotted `X.id`
  // by suffix, so a raw op_id parked in `attacker.id`/`foo.id` would slip
  // (`{ operationId: attacker.id }`); an unknown `<x>.id` is no longer allowed.
  if (v === 'id' || v === 'rowId') return true
  const dotId = /^([A-Za-z_$][\w$]*)\.id$/.exec(v)
  if (dotId && PK_ROW_BINDINGS.has(dotId[1])) return true
  // A `.map(…)` over redacted elements — the two `operationIds` array sites
  // (`sample.map((s) => s.id)` / `…map((op) => settlementEntryId(op))`). The
  // arrow's `=> X.id` element read is the array analogue of the row `.id` above
  // (a per-element PK projection); the redaction-fn arrows close the rest.
  if (/\.map\s*\(/.test(v)) {
    if (/(settlementEntryId|redactOpId|redactLogString)\s*\(/.test(v)) return true
    if (/=>\s*[A-Za-z_$][\w$.]*\.id\b/.test(v)) return true
  }
  return false
}

interface Violation { msg: string | null; key: string; kind: 'shorthand' | 'value'; value?: string }

type KeyClass =
  | { kind: 'none' }
  | { kind: 'shorthand' }
  | { kind: 'key'; colonIdx: number }

/**
 * Classify a forbidden word found at `[keyStart, keyEnd)` in a call span: is it an
 * object KEY (plain `operationId:`, QUOTED `'operationId':`, or COMPUTED
 * `['operationId']:`) — and if so where is its `:` — or a SHORTHAND (`{ operationId }`),
 * or NONE (a member `.from`, a call-arg, a ternary/label, a param annotation)?
 */
function classifyKey(s: string, keyStart: number, keyEnd: number): KeyClass {
  // Left context: nearest non-space char before the identifier.
  let p = keyStart - 1
  while (p >= 0 && /\s/.test(s[p])) p--
  let left = p >= 0 ? s[p] : ''
  let quoteCh = ''
  if (left === '\'' || left === '"') {
    quoteCh = left
    p--
    while (p >= 0 && /\s/.test(s[p])) p--
    left = p >= 0 ? s[p] : '' // '{' / ',' (quoted plain key) or '[' (computed key)
  }
  // Right context: nearest non-space char after the identifier.
  let n = keyEnd
  while (n < s.length && /\s/.test(s[n])) n++
  let right = n < s.length ? s[n] : ''

  if (quoteCh) {
    if (right !== quoteCh) return { kind: 'none' } // not actually a quoted token
    n++
    while (n < s.length && /\s/.test(s[n])) n++
    right = n < s.length ? s[n] : ''
    if (left === '[') {
      // Computed: `[ 'operationId' ] :` — expect ']' then ':'.
      if (right !== ']') return { kind: 'none' }
      n++
      while (n < s.length && /\s/.test(s[n])) n++
      if (s[n] !== ':') return { kind: 'none' }
      return { kind: 'key', colonIdx: n }
    }
    // Quoted plain: `'operationId' :` — preceded by an object opener.
    if (right !== ':' || (left !== '{' && left !== ',')) return { kind: 'none' }
    return { kind: 'key', colonIdx: n }
  }

  // Unquoted identifier.
  if (right === ':') {
    // A plain object key only when preceded by `{`/`,` (else a ternary/label/annotation).
    if (left === '{' || left === ',') return { kind: 'key', colonIdx: n }
    return { kind: 'none' }
  }
  if ((right === ',' || right === '}' || right === '') && (left === '{' || left === ',')) {
    return { kind: 'shorthand' } // `{ key }` / `{ key, }` — always the raw variable.
  }
  return { kind: 'none' }
}

/** Scan one source string; return every forbidden-key violation in a logger span. */
function scanSource(content: string): Violation[] {
  const violations: Violation[] = []
  for (const openIdx of loggerCallOpens(content)) {
    const close = matchClose(content, openIdx)
    if (close === -1) {
      violations.push({ msg: '<RUNAWAY-PARSE>', key: '<call>', kind: 'value' })
      continue
    }
    const span = content.slice(openIdx, close + 1)
    const msg = firstStringArg(span)
    for (const K of FORBIDDEN) {
      const re = new RegExp('(^|[^\\w$])(' + K + ')(?=[^\\w$]|$)', 'g')
      let km: RegExpExecArray | null
      while ((km = re.exec(span))) {
        const keyStart = km.index + km[1].length
        const keyEnd = keyStart + K.length
        if (BENIGN.has(`${msg}::${K}`)) continue
        const cls = classifyKey(span, keyStart, keyEnd)
        if (cls.kind === 'shorthand') {
          violations.push({ msg, key: K, kind: 'shorthand' })
        } else if (cls.kind === 'key') {
          const value = captureValue(span, cls.colonIdx)
          if (!isAllowedValue(value)) violations.push({ msg, key: K, kind: 'value', value })
        }
        // cls.kind === 'none' → not a forbidden object key (member / call-arg /
        // param annotation / ternary) → skip.
      }
    }
  }
  return violations
}

describe('V-N3 grep-guard — payer-key COMPLETENESS scan over apps/web/src', () => {
  it('scans a NON-EMPTY set of real source files (DC-05 non-vacuity)', () => {
    const files = sourceFiles(SRC_ROOT)
    expect(files.length).toBeGreaterThan(100)
    // sanity: the settlement files we redacted are in scope
    expect(files.some((f) => f.endsWith(join('settlement', 'reconcile.ts')))).toBe(true)
  })

  it('finds ZERO raw payer keys in any logger-shaped call (dot / aliased / computed)', () => {
    const files = sourceFiles(SRC_ROOT)
    const offenders: string[] = []
    for (const f of files) {
      const vs = scanSource(readFileSync(f, 'utf8'))
      for (const v of vs) {
        offenders.push(
          `${f.replace(SRC_ROOT, 'src')} :: event=${v.msg ?? '?'} key=${v.key} kind=${v.kind}` +
            (v.value !== undefined ? ` value=${JSON.stringify(v.value)}` : ''),
        )
      }
    }
    expect(offenders, `raw payer keys still reach a log sink:\n${offenders.join('\n')}`).toEqual([])
  })
})

describe('V-N3 grep-guard — self-test (the guard itself is NON-VACUOUS)', () => {
  it('FLAGS a raw shorthand operationId', () => {
    expect(scanSource(`logger.info('x', { operationId, rail })`)).toHaveLength(1)
  })

  it('FLAGS a raw key:value (the {operationId: op} alias) and a raw from/nonce', () => {
    expect(scanSource(`logger.error('x', { operationId: op })`)).toHaveLength(1)
    expect(scanSource(`logger.error('x', { from: parsed.from, nonce: parsed.nonce })`)).toHaveLength(2)
  })

  it('FLAGS the invocationId key and an operationIds array of raw op_ids', () => {
    expect(scanSource(`logger.error('x', { invocationId: input.invocationId }, err)`)).toHaveLength(1)
    expect(scanSource(`logger.error('x', { operationIds: ops })`)).toHaveLength(1)
    expect(scanSource(`logger.error('x', { operationIds: ops.map((o) => o.operationId) })`)).toHaveLength(1)
  })

  it('PASSES the redacted forms', () => {
    expect(scanSource(`logger.info('x', { operationId: settlementEntryId(operationId), rail })`)).toEqual([])
    expect(scanSource(`logger.info('x', { operationId: settlementEntryId(operationId ?? 'unknown') })`)).toEqual([])
    expect(scanSource(`logger.warn('x', { operationId: redactOpId(operationId), rail })`)).toEqual([])
    expect(scanSource(`logger.error('x', { operationId: row.id, rail })`)).toEqual([])
    expect(scanSource(`logger.error('x', { operationId: rowId, rail })`)).toEqual([])
    expect(scanSource(`logger.error('x', { invocationId: settlementEntryId(input.invocationId) }, err)`)).toEqual([])
    expect(scanSource(`logger.error('x', { operationIds: sample.map((s) => s.id) })`)).toEqual([])
    expect(scanSource(`logger.error('x', { operationIds: ops.map((op) => settlementEntryId(op ?? 'unknown')) })`)).toEqual([])
  })

  it('does NOT flag a forbidden word that is not an object key (member / call-arg / value)', () => {
    expect(scanSource(`logger.info('x', { count: Array.from(xs).length })`)).toEqual([]) // Array.from
    expect(scanSource(`logger.info('x', { token: settlementEntryId(operationId) })`)).toEqual([]) // op as call-arg
    expect(scanSource(`logger.info('x', { label: emailFrom })`)).toEqual([]) // 'from' inside an identifier
  })

  it('PASSES the documented benign non-settlement from: sites, but FLAGS from: in any other event', () => {
    expect(scanSource(`logger.info('billing.change_plan.success', { from: developer.tier, to: body.plan })`)).toEqual([])
    expect(scanSource(`logger.info('crawler.npm.query_completed', { from: currentWithinOffset, total })`)).toEqual([])
    // a from: in a DIFFERENT (settlement-ish) event is still caught
    expect(scanSource(`logger.error('reconcile.something', { from: parsed.eip3009.from })`)).toHaveLength(1)
  })
})

describe('V-N3 grep-guard — ② hardening: aliased / quoted / computed / dynamic forms + the seam', () => {
  it('FLAGS a raw payer key on an ALIASED logger (appLogger / this.logger) — the H1 class', () => {
    expect(scanSource(`appLogger.info('x', { payer: result.payerAddress })`)).toHaveLength(1)
    expect(scanSource(`appLogger.error('x', { from: p.from, nonce: p.nonce })`)).toHaveLength(2)
    expect(scanSource(`this.logger.warn('x', { operationId: op })`)).toHaveLength(1)
  })

  it('FLAGS the new payerAddress / drainNonce keys (the M1 adapter key set)', () => {
    expect(scanSource(`logger.info('x', { payerAddress: v.payer })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { drainNonce: voucher.nonce })`)).toHaveLength(1)
  })

  it("FLAGS a QUOTED key ('operationId':) and a COMPUTED key (['operationId']:)", () => {
    expect(scanSource(`logger.error('x', { 'operationId': op })`)).toHaveLength(1)
    expect(scanSource(`logger.error('x', { "payer": p })`)).toHaveLength(1)
    expect(scanSource(`logger.error('x', { ['operationId']: op })`)).toHaveLength(1)
  })

  it('GREEN on a quoted / computed key bound to a sanctioned redaction', () => {
    expect(scanSource(`logger.error('x', { 'operationId': settlementEntryId(op) })`)).toEqual([])
    expect(scanSource(`logger.error('x', { ['operationId']: row.id })`)).toEqual([])
  })

  it("FLAGS the DYNAMIC logger['level'](…) form, incl. a ternary index", () => {
    expect(scanSource(`logger['error']('x', { operationId })`)).toHaveLength(1)
    expect(scanSource(`logger[crit ? 'error' : 'warn']('x', { operationId: op })`)).toHaveLength(1)
  })

  it('GREEN on the dynamic form when redacted', () => {
    expect(scanSource(`logger['error']('x', { operationId: settlementEntryId(operationId) })`)).toEqual([])
  })

  it('SEES + PASSES the sanitizing-appLogger seam (a sanitized forwarding call, not a raw literal)', () => {
    expect(scanSource(`logger.info(event, sanitizeAdapterMeta(data) ?? {})`)).toEqual([])
    // the factory binding is not a logger CALL → nothing to scan
    expect(scanSource(`const appLogger: AdapterLogger = createSanitizingAdapterLogger()`)).toEqual([])
  })

  it('provenance: a raw op_id parked in a …Id-suffixed var is NO LONGER auto-allowed', () => {
    expect(scanSource(`logger.info('x', { operationId: someId })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { operationId: hopId })`)).toHaveLength(1)
    // the sanctioned de-identified PK reads still pass
    expect(scanSource(`logger.info('x', { operationId: id })`)).toEqual([])
    expect(scanSource(`logger.info('x', { operationId: row.id })`)).toEqual([])
    expect(scanSource(`logger.info('x', { operationId: rowId })`)).toEqual([])
  })
})

describe('V-N3 grep-guard — ② re-review #2 follow-ups (B4 / B6 / B7 / B8)', () => {
  it('B4: FLAGS a raw channelId / channelAddress key, PASSES the sanctioned PK / redaction forms', () => {
    // The drain adapter logs `channelId: voucher.channelAddress` (raw 0x<40>) in
    // packages/mcp (not walked) — the seam strips it at runtime; the guard now
    // forbids the SAME keys in any apps/web/src logger span.
    expect(scanSource(`logger.info('x', { channelId: voucher.channelAddress })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { channelAddress: getChannel() })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { channelId: row.id })`)).toEqual([])
    expect(scanSource(`logger.info('x', { channelId: redactLogString(addr) })`)).toEqual([])
    // a DIFFERENT key (drainChannelId, DB-metadata land) is NOT this key — no false match
    expect(scanSource(`logger.info('x', { drainChannelId: row.id })`)).toEqual([])
  })

  it('B7: the dotted .id allow is restricted to known PK-row bindings (row/current/existing)', () => {
    // The sanctioned settlement-row objects pass…
    expect(scanSource(`logger.info('x', { operationId: row.id })`)).toEqual([])
    expect(scanSource(`logger.warn('x', { operationId: current.id })`)).toEqual([])
    expect(scanSource(`logger.error('x', { operationId: existing.id })`)).toEqual([])
    // …but an arbitrary `<x>.id` no longer slips through by suffix-shape.
    expect(scanSource(`logger.info('x', { operationId: attacker.id })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { operationId: foo.id })`)).toHaveLength(1)
    expect(scanSource(`logger.info('x', { operationId: req.body.id })`)).toHaveLength(1)
  })

  it('B6 (DOCUMENTED LIMITATION, LATENT): a regex-literal arg defeats the call-span lexer', () => {
    // A `)` inside a regex char-class/group closes the call span EARLY, so a
    // forbidden key AFTER the regex is silently missed (a false NEGATIVE). No live
    // logger call passes a regex arg (verified by the green real-file scan); pinned
    // here so a regression — or a future fix that adds regex recognition (which
    // would flip this to length 1) — is VISIBLE. The runtime seam + emit()
    // sanitizer remain the real PII defenses regardless.
    expect(scanSource(`logger.info('x', { pattern: /ab)cd/, operationId })`)).toEqual([])
    // An unbalanced `(` inside a regex runs the span off the end → RUNAWAY-PARSE
    // (a loud false-POSITIVE, not a silent miss — fails closed).
    expect(scanSource(`logger.info('x', { pattern: /a(b/ })`)).toEqual([
      { msg: '<RUNAWAY-PARSE>', key: '<call>', kind: 'value' },
    ])
  })

  it('B8 (DOCUMENTED LIMITATION, LATENT): a spread {...bag} into meta is not introspected', () => {
    // The guard reads literal object KEYS, not the contents of a spread source, so
    // a payer key hidden inside `bag` would not be seen. Verified: no live logger
    // spread source carries a payer key (spread bags hold numeric counts). LATENT;
    // pinned so the assumption stays explicit.
    expect(scanSource(`logger.info('x', { ...bag, rail })`)).toEqual([])
    // A literal payer key ALONGSIDE the spread is still caught.
    expect(scanSource(`logger.info('x', { ...bag, operationId })`)).toHaveLength(1)
  })
})
