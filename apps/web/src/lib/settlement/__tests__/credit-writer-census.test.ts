/**
 * (T) — LB-1 credit-writer CENSUS pin.
 *
 * The uncredited-row sweep (reconcile.ts) is only as honest as this census:
 * every path that commits a developer credit FOR a settled reconcilable-rail
 * row must write the credited_at marker in the SAME transaction — one missed
 * writer makes the sweep false-positive those rows forever (alarm fatigue
 * burying real losses); a non-crediting path writing the marker would
 * false-negative a genuine loss.
 *
 * This suite source-scans `src` (file granularity — NO line numbers, so
 * ordinary drift can't flake it) and FAILS THE BUILD when:
 *   (a) a NEW `developers.balanceCents` increment site appears that is not in
 *       the classified allowlist below (classify it against the sweep
 *       universe — trace §1b — before extending the list);
 *   (b) a `markSettlementFailed` call site stops passing the CAS hash;
 *   (c) a `creditSettlement` call site stops passing `rail` (the marker key).
 *
 * Classification (docs/tech-debt/t-terminal-transition-trace-2026-06-10.md §1b):
 * MARKER WRITERS (credit FOR settled reconcilable-rail rows):
 *   - reconcile.ts creditSettlement (W1 reconciler tail + W2 kernel /settle)
 *   - proxy route forwardAndBill (W3 x402 + W4 circle-nano): TWO sites — the
 *     legacy Promise.all branch (non-settlement rails, byte-frozen) and the
 *     (T) transactional twin (on-chain, writes the marker).
 * NON-MEMBERS (no settled reconcilable-rail row involved):
 *   - proxy prepaid/balance/MPP handler credits; sessions settlement-batch
 *     disbursements; payout-failure refunds / rollback re-credits (billing
 *     webhook, payouts cron, payouts/process); SDK metering revenue shares.
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

const CREDIT_INCREMENT = /balanceCents:\s*sql`\$\{developers\.balanceCents\}\s*\+/g

/** POST-(T) classified census — file → expected increment-site count. */
const CENSUS: Record<string, number> = {
  // MARKER WRITERS
  'src/lib/settlement/reconcile.ts': 1, // creditSettlement (W1+W2) — marker in-txn
  'src/app/api/proxy/[slug]/route.ts': 6, // 4 non-settlement handler credits + forwardAndBill's legacy branch + the (T) transactional twin (W3+W4, marker in-txn)
  // NON-MEMBERS (classified out of the sweep universe — trace §1b)
  'src/lib/settlement/sessions.ts': 1,
  'src/app/api/billing/webhook/route.ts': 1,
  'src/app/api/cron/process-payouts/route.ts': 1,
  'src/lib/payouts/process.ts': 1,
  'src/app/api/sdk/meter/route.ts': 1,
  'src/app/api/sdk/meter-with-metadata/route.ts': 1,
  'src/lib/metering.ts': 1,
}

describe('(T) LB-1 credit-writer census', () => {
  it('every developers.balanceCents increment site is classified — a NEW site fails until censused', () => {
    const found: Record<string, number> = {}
    for (const f of FILES) {
      const matches = readFileSync(f, 'utf8').match(CREDIT_INCREMENT)
      if (matches) found[rel(f)] = matches.length
    }
    expect(found).toEqual(CENSUS)
  })

  it('every markSettlementFailed call site passes the CAS hash (3 args) — an evidence-less terminal flip fails here', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      if (rel(f) === 'src/lib/settlement/ledger.ts') continue // the definition
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/markSettlementFailed\(([^)]*)\)/g)) {
        const argCount = m[1].split(',').length
        if (argCount < 3) offenders.push(`${rel(f)}: markSettlementFailed(${m[1]})`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('every creditSettlement call site passes rail (the credited_at marker key)', () => {
    const offenders: string[] = []
    for (const f of FILES) {
      if (rel(f) === 'src/lib/settlement/reconcile.ts' && !readFileSync(f, 'utf8').includes('await creditSettlement')) continue
      const src = readFileSync(f, 'utf8')
      for (const m of src.matchAll(/await creditSettlement\(\{([\s\S]*?)\}\)/g)) {
        // `rail: 'x'` or the shorthand `rail,` both count.
        if (!/\brail\s*[:,]/.test(m[1])) offenders.push(`${rel(f)}: creditSettlement call without rail`)
      }
    }
    expect(offenders).toEqual([])
  })
})
