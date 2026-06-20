/**
 * V-N3-invocations-min — the anti-regression CENSUS GUARD (handoff §5#5 / §8 / §9;
 * the durable DC-16 anti-regression for the `invocations.metadata` payer surface).
 *
 * It STATICALLY scans the proxy `route.ts` and FAILS THE BUILD if a NEW
 * EVM-payer-shaped metadata key appears in a protocol-invocation writer literal or
 * a per-rail `extraMeta` builder OUTSIDE the minimizer's coverage. This is how
 * `drainChannelId` was originally missed — a vacuous "the known keys are removed"
 * guard would NOT catch a 6th key; this one classifies by NAME-SHAPE, so a new
 * `senderAddress` / `payerEoa` / `fromAddress` trips it (proven by the self-test).
 *
 * Three checks, modeled on `credit-writer-census.test.ts` / `log-redaction-guard.test.ts`:
 *   (1) BOTH writers enumerated EXACTLY: `recordProtocolInvocation`'s merged
 *       metadata literal + `recordMppInvocation`'s metadata literal — a key added
 *       directly to either fails until classified (exact-set equality).
 *   (2) COMPLETENESS: every EVM-payer-SHAPED metadata key across both writers AND
 *       every `forwardAndBill` call-site / `extraMeta = {…}` builder, MINUS the
 *       documented retained exception, is ⊆ the minimizer's coverage
 *       (INVOCATIONS_EVM_PAYER_KEYS ∪ payerIdentifier) — imported from the module
 *       (single source of truth).
 *   (3) The mpp `mppPayerCustomerId` (a Stripe `cus_…` id, non-EVM, R2) is the
 *       ONE documented payer-SHAPED key deliberately RETAINED — not minimized,
 *       not false-flagged.
 *
 * `route.ts` source is asserted non-empty + the extracted writer literals non-empty
 * (DC-05 non-vacuity).
 */
import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// The module's runtime deps are not exercised here (we import only the key
// constants), but stub them so importing the module performs zero DB/log init.
vi.mock('@/lib/db', () => ({ db: {} }))
vi.mock('@/lib/logger', () => ({ logger: { info: () => {}, warn: () => {}, error: () => {} } }))

import {
  INVOCATIONS_EVM_PAYER_KEYS,
  RAIL_GATED_PAYER_KEY,
  DRAIN_EVM_PAYER_KEYS,
  PROTOCOL_SENTINEL_ID,
} from '../invocations-payer-min'

const ROUTE = readFileSync(
  resolve(__dirname, '../../../app/api/proxy/[slug]/route.ts'),
  'utf8',
)

// ── The classifier (the bar — NAME-shape, not a fixed list) ──────────────────
/** A metadata key whose NAME looks like it could carry a raw EVM payer / channel
 *  identifier. Deliberately broad so a creatively-named NEW key is still caught;
 *  benign matches are handled by {@link RETAINED} + {@link COVERAGE}. */
// ③ deep audit broadened the name set with EVM/payer synonyms that were
// false-negatives (evmFrom / txOrigin / beneficiary / spender / originator /
// recipient). Fail-closed: a creatively-named NEW payer key trips the completeness
// check; benign matches are absorbed by RETAINED / COVERAGE. (Verified no
// false-positive on any current scanned key.) NOTE: this is NAME-shape only — it
// CANNOT see an EVM value under a generic name (e.g. drain's paymentId == channel
// address); that class is pinned explicitly by the value-provenance test below.
const EVM_PAYER_SHAPED =
  /payer|payee|wallet|eoa|sender|address|nonce|channel|^from$|fromaddr|beneficiary|spender|originator|recipient|txorigin|evmfrom/i
/** The minimizer's coverage (imported — single source of truth; includes the
 *  drain-gated DRAIN_EVM_PAYER_KEYS added by the ③ deep audit). */
const COVERAGE = new Set<string>([
  ...INVOCATIONS_EVM_PAYER_KEYS,
  RAIL_GATED_PAYER_KEY,
  ...DRAIN_EVM_PAYER_KEYS,
])
/** The ONE documented payer-SHAPED key deliberately retained: the mpp Stripe
 *  customer id (non-EVM, R2). NOT minimized. */
const RETAINED = new Set<string>(['mppPayerCustomerId'])

/** Keys that are payer-SHAPED, not the documented retained exception, and NOT in
 *  the minimizer's coverage → a leak the guard must fail on. */
function uncovered(keys: Iterable<string>): string[] {
  const out: string[] = []
  for (const k of keys) {
    if (EVM_PAYER_SHAPED.test(k) && !RETAINED.has(k) && !COVERAGE.has(k)) out.push(k)
  }
  return [...new Set(out)].sort()
}

// ── Lexers (string/template/comment-aware; the proven log-redaction patterns) ─
/** From an open `(`, the matching close `)`. -1 on a runaway scan. */
function matchCloseParen(s: string, openIdx: number): number {
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
    if (c === '\'' || c === '"') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 2; else i++ } i++; continue }
    if (c === '`') { stack.push({ t: 'template' }); i++; continue }
    if (c === '{') { if (top && top.t === 'expr') top.brace++; i++; continue }
    if (c === '}') { if (top && top.t === 'expr') { if (top.brace === 0) { stack.pop(); i++; continue } top.brace-- } i++; continue }
    if (c === '(') { depth++; i++; continue }
    if (c === ')') { depth--; if (depth === 0) return i; i++; continue }
    i++
  }
  return -1
}

/** From an open `{`, the matching close `}`. -1 on a runaway scan. */
function matchCloseBrace(s: string, openIdx: number): number {
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
    if (c === '\'' || c === '"') { const q = c; i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i += 2; else i++ } i++; continue }
    if (c === '`') { stack.push({ t: 'template' }); i++; continue }
    if (c === '(' || c === '[') { i++; continue }
    if (c === ')' || c === ']') { i++; continue }
    if (c === '{') { if (top && top.t === 'expr') top.brace++; else depth++; i++; continue }
    if (c === '}') {
      if (top && top.t === 'expr') { if (top.brace === 0) { stack.pop(); i++; continue } top.brace-- ; i++; continue }
      depth--; if (depth === 0) return i; i++; continue
    }
    i++
  }
  return -1
}

/** Every property key (`key:`, `'key':`, `"key":`, at any depth) inside a span.
 *  Over-inclusive by design (a benign over-collected key only matters if it is
 *  payer-SHAPED — none are); a shorthand-free metadata literal yields exactly its
 *  top-level keys. Spreads (`...x`) are not keys and are skipped (no `:`). */
function propertyKeys(span: string): Set<string> {
  const keys = new Set<string>()
  const re = /[{,]\s*(?:(['"])([A-Za-z_$][\w$-]*)\1|([A-Za-z_$][\w$]*))\s*:/g
  let m: RegExpExecArray | null
  while ((m = re.exec(span))) keys.add(m[2] ?? m[3])
  return keys
}

/** The top-level keys of the object literal that opens at the first `{` after `fromIdx`. */
function literalKeysAfter(fromIdx: number): Set<string> {
  const open = ROUTE.indexOf('{', fromIdx)
  const close = matchCloseBrace(ROUTE, open)
  return propertyKeys(ROUTE.slice(open, close + 1))
}

// ── Extract the two writer literals ──────────────────────────────────────────
const rpiKeys = literalKeysAfter(ROUTE.indexOf('const mergedMetadata'))
const mppFnIdx = ROUTE.indexOf('function recordMppInvocation')
const mppKeys = literalKeysAfter(ROUTE.indexOf('metadata: {', mppFnIdx))

// ── Extract every per-rail builder (forwardAndBill call spans + extraMeta = {}) ─
function builderKeys(): Set<string> {
  const keys = new Set<string>()
  // forwardAndBill CALL sites (not the definition) — catches the inline x402 /
  // circle-nano / ap2 / acp / l402 extraMetadata literals.
  for (const m of ROUTE.matchAll(/forwardAndBill\s*\(/g)) {
    const before = ROUTE.slice(Math.max(0, m.index - 16), m.index)
    if (/function\s*$/.test(before)) continue // skip the definition
    const open = ROUTE.indexOf('(', m.index)
    const close = matchCloseParen(ROUTE, open)
    if (close === -1) continue
    for (const k of propertyKeys(ROUTE.slice(open, close + 1))) keys.add(k)
  }
  // `extraMeta = { … }` assignments — the generic-protocol handler's per-rail
  // builders (ucp / mastercard / alipay / kyapay / emvco / drain).
  for (const m of ROUTE.matchAll(/\bextraMeta\s*=\s*\{/g)) {
    const open = ROUTE.indexOf('{', m.index)
    const close = matchCloseBrace(ROUTE, open)
    if (close === -1) continue
    for (const k of propertyKeys(ROUTE.slice(open, close + 1))) keys.add(k)
  }
  return keys
}
const extraKeys = builderKeys()

describe('V-N3 invocations-payer census — DC-05 non-vacuity', () => {
  it('scans a real, non-empty route.ts and extracts non-empty writer + builder literals', () => {
    expect(ROUTE.length).toBeGreaterThan(1000)
    expect(rpiKeys.size).toBeGreaterThan(0)
    expect(mppKeys.size).toBeGreaterThan(0)
    expect(extraKeys.size).toBeGreaterThan(0)
  })
})

describe('V-N3 invocations-payer census — BOTH writers enumerated exactly', () => {
  it('recordProtocolInvocation merged-metadata literal keys are the classified set', () => {
    expect([...rpiKeys].sort()).toEqual(
      ['payerIdentifier', 'paymentId', 'paymentMethod', 'proxy', 'toolSlug', 'upstreamStatus'],
    )
  })
  it('recordMppInvocation metadata literal keys are the classified set', () => {
    expect([...mppKeys].sort()).toEqual(
      ['mppPayerCustomerId', 'mppPaymentId', 'mppSessionId', 'paymentMethod', 'proxy', 'toolSlug', 'upstreamStatus'],
    )
  })
})

describe('V-N3 invocations-payer census — COMPLETENESS (payer-shaped ⊆ minimizer coverage)', () => {
  it('no EVM-payer-shaped metadata key escapes the minimizer (both writers + every builder)', () => {
    const all = new Set<string>([...rpiKeys, ...mppKeys, ...extraKeys])
    const leaks = uncovered(all)
    expect(leaks, `un-minimized EVM-payer-shaped metadata keys: ${leaks.join(', ')}`).toEqual([])
  })

  it('the known EVM-payer keys ARE present in the source (the guard sees real keys, not nothing)', () => {
    const all = new Set<string>([...rpiKeys, ...mppKeys, ...extraKeys])
    // payerIdentifier (rail-gated), payer + payerAddress (circle-nano),
    // drainChannelId + drainNonce (drain) — all live in the source AND in coverage.
    for (const k of ['payerIdentifier', 'payer', 'payerAddress', 'drainChannelId', 'drainNonce']) {
      expect(all.has(k), `expected ${k} in the scanned source`).toBe(true)
      expect(EVM_PAYER_SHAPED.test(k)).toBe(true)
    }
  })
})

describe('V-N3 invocations-payer census — mpp mppPayerCustomerId is the documented retained exception', () => {
  it('mppPayerCustomerId is payer-SHAPED but RETAINED (non-EVM Stripe id) and NOT minimized', () => {
    expect(mppKeys.has('mppPayerCustomerId')).toBe(true)
    expect(EVM_PAYER_SHAPED.test('mppPayerCustomerId')).toBe(true) // it LOOKS payer-shaped …
    expect(RETAINED.has('mppPayerCustomerId')).toBe(true) // … but is the documented R2 exception …
    expect(COVERAGE.has('mppPayerCustomerId')).toBe(false) // … and is NOT in the minimizer set
    // so the completeness check does NOT flag it:
    expect(uncovered(['mppPayerCustomerId'])).toEqual([])
  })
})

describe('V-N3 invocations-payer census — the guard itself is NON-VACUOUS', () => {
  it('FLAGS a synthetic NEW EVM-payer-shaped key injected into a forwardAndBill literal (the 6th-key trap)', () => {
    const synthetic =
      "forwardAndBill(request, toolRow, 'drain', costCents, slug, requestId, startTime, paymentId, payerIdentifier, {}, { drainChannelId: x, senderAddress: y })"
    const open = synthetic.indexOf('(')
    const span = synthetic.slice(open, matchCloseParen(synthetic, open) + 1)
    expect(uncovered(propertyKeys(span))).toEqual(['senderAddress'])
  })

  it('FLAGS other plausibly-named new payer keys (payerEoa / fromAddress / walletAddress)', () => {
    expect(uncovered(['payerEoa'])).toEqual(['payerEoa'])
    expect(uncovered(['fromAddress'])).toEqual(['fromAddress'])
    expect(uncovered(['walletAddress'])).toEqual(['walletAddress'])
  })

  it('GREEN on a literal that carries only covered / retained / non-payer keys', () => {
    const ok = '{ proxy: true, paymentMethod: m, drainChannelId: c, payer: p, mppPayerCustomerId: s, network: n, amountUsdc: a }'
    expect(uncovered(propertyKeys(ok))).toEqual([])
  })

  it('GREEN on the non-EVM rails own-prefixed ids (NOT over-flagged)', () => {
    // ucpPaymentHandler / kyapayAgentId / circleNanoConfirmationId / l402PreimageHash
    // are non-EVM and (correctly) do NOT match the payer-shape heuristic.
    // (paymentId is handled by the value-provenance block below — it is name-shape
    // INVISIBLE here, which is exactly why drain's channel-address leak was missed.)
    for (const k of ['ucpPaymentHandler', 'kyapayAgentId', 'circleNanoConfirmationId', 'l402PreimageHash', 'paymentMethod']) {
      expect(uncovered([k]), `${k} should not be flagged`).toEqual([])
    }
  })
})

describe('V-N3 invocations-payer census — drain paymentId is the EVM channel address (VALUE-PROVENANCE, not name-shape)', () => {
  // ③ DEEP AUDIT: for the drain rail the proxy routes the raw EVM channel contract
  // address into the GENERIC `paymentId` key (the SAME value as drainChannelId;
  // route.ts: `paymentId = result.channelId`). A NAME-shape guard is structurally
  // blind to this (`paymentId` does not match EVM_PAYER_SHAPED), so these pins assert
  // the provenance FACT + that the minimizer covers it. If a refactor changes drain's
  // paymentId source, or drops the coverage, one of these fails and forces re-review.
  it('the proxy writes the EVM channel address into paymentId for drain (route.ts paymentId = result.channelId)', () => {
    expect(ROUTE).toMatch(/paymentId = result\.channelId/)
  })
  it('paymentId is name-shape INVISIBLE to the classifier (documents WHY the explicit pin is needed)', () => {
    expect(EVM_PAYER_SHAPED.test('paymentId')).toBe(false)
  })
  it('the minimizer COVERS drain paymentId via DRAIN_EVM_PAYER_KEYS', () => {
    expect([...DRAIN_EVM_PAYER_KEYS]).toContain('paymentId')
    expect(COVERAGE.has('paymentId')).toBe(true)
  })
  it('paymentId is NOT in the UNCONDITIONAL set (non-drain rails retain it as a non-EVM ref)', () => {
    expect([...INVOCATIONS_EVM_PAYER_KEYS]).not.toContain('paymentId')
  })
})

describe('V-N3 invocations-payer census — PROTOCOL_SENTINEL_ID cross-file drift guard', () => {
  // ③ DEEP AUDIT: the backfill is scoped to PROTOCOL_SENTINEL_ID; the proxy writes
  // protocol rows under the same literal in route.ts. They were duplicated with only
  // a "kept in sync" comment — a silent drift would scope the backfill to the WRONG
  // consumer id while reporting success. This asserts they stay byte-identical.
  it('the module sentinel matches the proxy recordProtocolInvocation sentinel literal', () => {
    expect(PROTOCOL_SENTINEL_ID).toBe('00000000-0000-0000-0000-000000000002')
    expect(ROUTE).toContain(`const PROTOCOL_SENTINEL_ID = '${PROTOCOL_SENTINEL_ID}'`)
  })
})
