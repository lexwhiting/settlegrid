/**
 * (V-N2) §13.D — exactAmount:true census guard (mirror of credit-writer-census).
 *
 * The reconciler tail credits the ACTUAL settled value UNCONDITIONALLY (§13.C).
 * That is correct ONLY while `exactAmount:true` is UNIVERSAL at the EIP-3009
 * verifier (so `value === requiredBaseUnits === costCents × 10_000` exactly — a
 * settled value can only ever EQUAL the cost it was authorized for). The
 * verifier's non-exact `value >= required` branch is live-but-callerless and the
 * param DEFAULTS falsy; a future caller that omits `exactAmount:true` would let a
 * legit OVER-authorization (value > cost) settle, and the reconciler would then
 * credit the FULL over-paid value — silently over-crediting.
 *
 * This source-scan FAILS THE BUILD if any non-test caller of
 * verify{Eip3009,CircleNano}Authorization does not pass `exactAmount: true`. If a
 * caller ever legitimately needs the non-exact branch, the credit-settled-value
 * decision (and its detect companion) must be revisited FIRST — do not just
 * silence this guard.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = join(process.cwd(), 'src')

function walk(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    const s = statSync(p)
    if (s.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx)$/.test(entry) && !p.includes('__tests__') && !p.endsWith('.test.ts')) acc.push(p)
  }
  return acc
}

const FILES = walk(SRC)
const rel = (p: string) => relative(process.cwd(), p).replace(/\\/g, '/')

// The verifier's own module (definition + the back-compat alias re-export) — NOT
// a call site.
const VERIFIER_MODULE = 'src/lib/settlement/circle-nano/verify.ts'

// Matches an INVOCATION (identifier immediately followed by `(`); doc/comment
// mentions are never followed by `(`, so they are not matched.
const VERIFIER_CALL = /verify(?:Eip3009|CircleNano)Authorization\s*\(/g

/** Extract the balanced `(...)` argument span, given the index of the opening `(`. */
function extractCallArgs(src: string, openParenIdx: number): string {
  let depth = 0
  for (let i = openParenIdx; i < src.length; i++) {
    const ch = src[i]
    if (ch === '(') depth++
    else if (ch === ')') {
      depth--
      if (depth === 0) return src.slice(openParenIdx + 1, i)
    }
  }
  return src.slice(openParenIdx + 1)
}

describe('(V-N2 §13.D) verifier exactAmount census', () => {
  it('every verify{Eip3009,CircleNano}Authorization call site passes exactAmount: true (≥2 prod callers)', () => {
    const callSites: string[] = []
    const offenders: string[] = []
    for (const f of FILES) {
      if (rel(f) === VERIFIER_MODULE) continue // the definition + alias, not a call
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(VERIFIER_CALL)) {
        const openParenIdx = m.index! + m[0].length - 1
        const args = extractCallArgs(src, openParenIdx)
        const site = `${rel(f)}: ${m[0]}…)`
        callSites.push(site)
        if (!/exactAmount\s*:\s*true/.test(args)) offenders.push(site)
      }
    }
    // Non-vacuity: the two prod callers (x402 orchestrate + circle-nano-proxy)
    // must be present, so a regex that silently matches nothing fails loudly.
    expect(callSites.length).toBeGreaterThanOrEqual(2)
    expect(offenders).toEqual([])
  })
})
