/**
 * P5.PAYOUTS-2 — Source-invariant pin for the "credit gross to
 * developer balance" guarantee.
 *
 * Why a source-scanning test instead of a route-handler test:
 *
 * The proxy route is ~2200 lines with five payment-method paths
 * (cached / x402 / mpp / api-key / failover). Each path requires the
 * full Postgres + Redis + fraud-detection + Stripe + auth stack to
 * exercise end-to-end. The unified-dispatch test in this same
 * directory explicitly notes: "the route.ts handler itself is not
 * directly tested here — too many heavy dependencies."
 *
 * What we actually need to pin is the invariant: every site that
 * writes to `developers.balanceCents` credits the GROSS amount
 * (`costCents` / `actualCost` / `collectedCents` / `body.costCents`),
 * never `Math.floor(X * revenueSharePct / 100)`. The progressive
 * platform take is applied once, at payout time, in
 * `apps/web/src/lib/pricing.ts:calculateTakeCents`.
 *
 * Pre-Phase-2: 6 NET writers existed (5 in proxy/[slug]/route.ts, 1
 * in sdk/meter/route.ts). Post-Phase-2: 0. If a future regression
 * adds a NET writer back — even unintentionally — this test fails
 * loudly. That's the point.
 *
 * `lib/metering.ts` already credited gross before Phase 2 and is
 * also covered here as defense-in-depth.
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'

// Paths are relative to apps/web/ (vitest runs there).
const FILES = [
  'src/app/api/proxy/[slug]/route.ts',
  'src/app/api/sdk/meter/route.ts',
  'src/app/api/sdk/meter-with-metadata/route.ts',
  'src/lib/metering.ts',
]

/**
 * Match `developers.balanceCents` UPDATE-set expressions where the
 * RHS multiplies by `revenueSharePct`. Permissive enough to catch
 * common reformulations:
 *   sql`${developers.balanceCents} + ${X * revenueSharePct / 100}`
 *   sql`${developers.balanceCents} + ${Math.floor(X * (Y.revenueSharePct / 100))}`
 *
 * Whitespace + arbitrary intermediate identifiers tolerated.
 */
const NET_WRITER_PATTERNS: RegExp[] = [
  /developers\.balanceCents[^}]*revenueSharePct/i,
  /balanceCents:\s*sql`[^`]*developers\.balanceCents[^`]*revenueSharePct/i,
]

/**
 * Match the legitimate gross-credit shape:
 *   balanceCents: sql`${developers.balanceCents} + ${<bareIdentifier>}`
 * where the identifier is one of the recognized cost variables. We
 * count occurrences so a regression that drops a writer entirely
 * (silently dropping developer credit) also fails the invariant.
 */
const GROSS_WRITER_PATTERN =
  /balanceCents:\s*sql`\$\{developers\.balanceCents\}\s*\+\s*\$\{(costCents|actualCost|collectedCents|body\.costCents|developerShareCents)\}`/g

describe('Phase 2 invariant — developer balance credits are GROSS, not NET', () => {
  for (const relPath of FILES) {
    const abs = resolve(process.cwd(), relPath)
    const src = readFileSync(abs, 'utf8')

    it(`no NET writer (revenueSharePct multiplication into balanceCents) in ${relPath}`, () => {
      for (const pat of NET_WRITER_PATTERNS) {
        const match = src.match(pat)
        if (match) {
          throw new Error(
            `NET writer regression in ${relPath}: matched "${match[0].slice(0, 200)}". ` +
              `Developer balance must be credited GROSS; progressive take is applied at payout time only.`,
          )
        }
      }
    })
  }

  it('proxy/[slug]/route.ts has 6 GROSS balance writers (one per payment-method path + the (T) on-chain transactional twin)', () => {
    const abs = resolve(process.cwd(), 'src/app/api/proxy/[slug]/route.ts')
    const src = readFileSync(abs, 'utf8')
    const matches = src.match(GROSS_WRITER_PATTERN) ?? []
    // 6 sites: cached, x402-collected, mpp, api-key, failover, PLUS the (T)
    // on-chain transactional twin inside forwardAndBill (the settlement-keyed
    // credit txn that also writes the credited_at marker; the legacy
    // Promise.all branch was kept BYTE-identical rather than hoisting a shared
    // SET const, so the GROSS writer appears once per branch — R2 audit fix B2).
    expect(matches.length).toBe(6)
  })

  it('sdk/meter/route.ts has 1 GROSS balance writer', () => {
    const abs = resolve(process.cwd(), 'src/app/api/sdk/meter/route.ts')
    const src = readFileSync(abs, 'utf8')
    const matches = src.match(GROSS_WRITER_PATTERN) ?? []
    expect(matches.length).toBe(1)
  })

  it('lib/metering.ts has 1 GROSS balance writer', () => {
    const abs = resolve(process.cwd(), 'src/lib/metering.ts')
    const src = readFileSync(abs, 'utf8')
    // metering.ts uses a local `developerShareCents` const that
    // equals costCents (line ~306), so the writer matches the
    // `developerShareCents` arm of the pattern. This is intentional:
    // the variable name is preserved but its value is gross.
    const matches = src.match(GROSS_WRITER_PATTERN) ?? []
    expect(matches.length).toBe(1)
  })

  it('sdk/meter-with-metadata/route.ts has 1 GROSS balance writer', () => {
    // Same `developerShareCents = body.costCents` shape as
    // lib/metering.ts — the variable preserves the legacy name but
    // holds the gross value.
    const abs = resolve(process.cwd(), 'src/app/api/sdk/meter-with-metadata/route.ts')
    const src = readFileSync(abs, 'utf8')
    const matches = src.match(GROSS_WRITER_PATTERN) ?? []
    expect(matches.length).toBe(1)
  })
})
