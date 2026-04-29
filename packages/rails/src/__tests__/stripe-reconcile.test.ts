/**
 * P3.RAIL2 — Pure-function tests for the Stripe reconciliation
 * primitives in `packages/rails/src/stripe-reconcile.ts`. The
 * orchestration script (`scripts/reconcile-stripe.ts`) is tested
 * separately under `scripts/__tests__/`.
 *
 * Coverage targets the hostile-lens contracts:
 *   - cents-only arithmetic (no float drift)
 *   - UTC calendar-day alignment (boundary moments belong to the
 *     correct day)
 *   - bounded pagination (MAX_PAGES + cursor-stall guards fire)
 *   - two legs reconciled separately (charges, transfers)
 *   - frozen reports (caller can't mutate post-build)
 *   - 24h GitHub-issue rate-limit gate
 */

import { describe, it, expect } from 'vitest'

import {
  computeDriftBps,
  fetchBalanceTransactionsForUtcDay,
  fetchTransfersForUtcDay,
  formatReconcileSummary,
  groupTransfersByDestinationAccount,
  reconcileLeg,
  resolveTransfersLedgerDestination,
  shouldOpenIssue,
  utcDayBounds,
  type DriftReport,
  type LedgerEntryForReconcile,
  type StripeBalanceTransaction,
  type StripeReconcileClient,
  type StripeTransfer,
} from '../stripe-reconcile'

// ─── helpers ─────────────────────────────────────────────────────────

function ledger(
  id: string,
  externalRef: string | null,
  amountCents: number,
): LedgerEntryForReconcile {
  return {
    id,
    externalRef,
    amountCents,
    rail: 'stripe-connect',
    settledAt: '2026-04-24T12:00:00.000Z',
  }
}

function bt(
  id: string,
  source: string | null,
  amount: number,
): StripeBalanceTransaction {
  return {
    id,
    amount,
    currency: 'usd',
    type: 'charge',
    source,
    created: 1_700_000_000,
    net: amount,
  }
}

function tr(id: string, destination: string | null, amount: number): StripeTransfer {
  return {
    id,
    amount,
    currency: 'usd',
    destination,
    created: 1_700_000_000,
  }
}

/** Pageable list mock — yields `pages` arrays in order. */
function mockListPages<T extends { id: string }>(pages: readonly T[][]): {
  list: (params: { starting_after?: string }) => Promise<{ data: T[]; has_more: boolean }>
  callCount: () => number
} {
  let i = 0
  let calls = 0
  return {
    list: async () => {
      calls++
      const data = pages[i] ?? []
      const hasMore = i < pages.length - 1
      i++
      return { data: [...data], has_more: hasMore }
    },
    callCount: () => calls,
  }
}

// ─── utcDayBounds ────────────────────────────────────────────────────

describe('utcDayBounds', () => {
  it('returns 24-hour Unix-second window starting at UTC midnight', () => {
    const r = utcDayBounds('2026-04-24')
    expect(r.dateUtc).toBe('2026-04-24')
    expect(new Date(r.startSec * 1000).toISOString()).toBe('2026-04-24T00:00:00.000Z')
    expect(new Date(r.endSec * 1000).toISOString()).toBe('2026-04-25T00:00:00.000Z')
    expect(r.endSec - r.startSec).toBe(24 * 60 * 60)
  })

  it('puts midnight UTC into the day that starts there (not the day before)', () => {
    // 2026-04-24 00:00:00 UTC must equal startSec for 2026-04-24
    // and ALSO equal endSec for 2026-04-23 (boundary belongs to 2026-04-24).
    const today = utcDayBounds('2026-04-24')
    const yesterday = utcDayBounds('2026-04-23')
    expect(today.startSec).toBe(yesterday.endSec)
    // The 23:59:59 instant on 2026-04-24 falls strictly within today.
    expect(today.startSec + 23 * 3600 + 59 * 60 + 59).toBeLessThan(today.endSec)
  })

  it('rejects malformed strings and invalid calendar dates', () => {
    expect(() => utcDayBounds('2026-4-24')).toThrow(TypeError)
    expect(() => utcDayBounds('not-a-date')).toThrow(TypeError)
    // Date.UTC silently rolls 02-30 into March; round-trip catch fires.
    expect(() => utcDayBounds('2026-02-30')).toThrow(/not a valid UTC calendar date/)
    expect(() => utcDayBounds('2026-13-01')).toThrow(TypeError)
    // @ts-expect-error — wrong type
    expect(() => utcDayBounds(undefined)).toThrow(TypeError)
  })

  it('returns a frozen object', () => {
    const r = utcDayBounds('2026-04-24')
    expect(Object.isFrozen(r)).toBe(true)
  })
})

// ─── pagination ──────────────────────────────────────────────────────

describe('fetchBalanceTransactionsForUtcDay (pagination)', () => {
  it('walks pages until has_more=false and returns a frozen array', async () => {
    const m = mockListPages<StripeBalanceTransaction>([
      [bt('txn_1', 'ch_1', 100), bt('txn_2', 'ch_2', 200)],
      [bt('txn_3', 'ch_3', 300)],
    ])
    const client: StripeReconcileClient = {
      balanceTransactions: { list: m.list },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    const out = await fetchBalanceTransactionsForUtcDay(client, '2026-04-24')
    expect(out.map((x) => x.id)).toEqual(['txn_1', 'txn_2', 'txn_3'])
    expect(Object.isFrozen(out)).toBe(true)
    expect(m.callCount()).toBe(2)
  })

  it('passes the UTC-day created window to the list call', async () => {
    let captured: { gte?: number; lt?: number } | undefined
    const client: StripeReconcileClient = {
      balanceTransactions: {
        list: async (params) => {
          captured = params.created
          return { data: [], has_more: false }
        },
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await fetchBalanceTransactionsForUtcDay(client, '2026-04-24')
    const expected = utcDayBounds('2026-04-24')
    expect(captured?.gte).toBe(expected.startSec)
    expect(captured?.lt).toBe(expected.endSec)
  })

  it('throws when a Stripe response item is missing a string id', async () => {
    const client: StripeReconcileClient = {
      balanceTransactions: {
        // @ts-expect-error — deliberately malformed item
        list: async () => ({ data: [{ amount: 100 }], has_more: false }),
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/missing string `id`/)
  })

  it('throws when an item has an empty-string id', async () => {
    const client: StripeReconcileClient = {
      balanceTransactions: {
        list: async () => ({
          data: [
            {
              id: '',
              amount: 100,
              currency: 'usd',
              type: 'charge',
              source: 'ch_x',
              created: 1_700_000_000,
              net: 100,
            },
          ],
          has_more: false,
        }),
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/missing string `id`/)
  })

  it('throws when pagination exceeds MAX_PAGES (defends against runaway loops)', async () => {
    let i = 0
    const client: StripeReconcileClient = {
      balanceTransactions: {
        // Always returns has_more=true with one fresh-id item per page.
        // The MAX_PAGES guard (1000) fires after 1000 calls.
        list: async () => ({
          data: [bt(`txn_${i++}`, `ch_${i}`, 1)],
          has_more: true,
        }),
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/exceeded.*pages/)
    // 1000 iterations consumed (plus or minus the final throw).
    expect(i).toBeGreaterThanOrEqual(1000)
  })

  it('throws on duplicate id across pages (cursor not advancing)', async () => {
    const dup = bt('txn_dup', 'ch_dup', 100)
    let callCount = 0
    const client: StripeReconcileClient = {
      balanceTransactions: {
        list: async () => {
          callCount++
          // Always returns the same row + has_more=true. Without the
          // duplicate guard, paginate would push the same row 1000 ×
          // 100 times before the page-cap fired.
          return { data: [dup], has_more: true }
        },
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/duplicate id|cursor not advancing/)
    expect(callCount).toBeLessThanOrEqual(2) // bails on the second page
  })

  it('throws on cursor stall (has_more=true but data is empty)', async () => {
    let calls = 0
    const client: StripeReconcileClient = {
      balanceTransactions: {
        list: async () => {
          calls++
          // Always returns empty data with has_more=true → cursor stalled.
          return { data: [], has_more: true }
        },
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/cursor stalled/)
    // Bails after the very first stalled page.
    expect(calls).toBe(1)
  })

  it('throws on malformed Stripe response', async () => {
    const client: StripeReconcileClient = {
      balanceTransactions: {
        // @ts-expect-error — deliberately malformed
        list: async () => ({ data: null, has_more: 'yes' }),
      },
      transfers: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(
      fetchBalanceTransactionsForUtcDay(client, '2026-04-24'),
    ).rejects.toThrow(/malformed response/)
  })
})

describe('fetchTransfersForUtcDay', () => {
  it('walks pages and returns transfers in order', async () => {
    const m = mockListPages<StripeTransfer>([
      [tr('tr_1', 'acct_a', 1_000), tr('tr_2', 'acct_b', 2_000)],
      [tr('tr_3', 'acct_a', 500)],
    ])
    const client: StripeReconcileClient = {
      balanceTransactions: { list: async () => ({ data: [], has_more: false }) },
      transfers: { list: m.list },
    }
    const out = await fetchTransfersForUtcDay(client, '2026-04-24')
    expect(out.map((x) => x.id)).toEqual(['tr_1', 'tr_2', 'tr_3'])
  })
})

// ─── groupTransfersByDestinationAccount ──────────────────────────────

describe('groupTransfersByDestinationAccount', () => {
  it('buckets multiple transfers per destination', () => {
    const out = groupTransfersByDestinationAccount([
      tr('tr_1', 'acct_a', 1_000),
      tr('tr_2', 'acct_a', 250), // retry after partial-failure
      tr('tr_3', 'acct_b', 500),
    ])
    expect(out.size).toBe(2)
    expect(out.get('acct_a')?.map((t) => t.id)).toEqual(['tr_1', 'tr_2'])
    expect(out.get('acct_b')?.map((t) => t.id)).toEqual(['tr_3'])
  })

  it('buckets null-destination transfers under sentinel key', () => {
    const out = groupTransfersByDestinationAccount([
      tr('tr_1', null, 100),
      tr('tr_2', 'acct_a', 200),
    ])
    expect(out.has('__null__')).toBe(true)
    expect(out.get('__null__')?.length).toBe(1)
  })

  it('returns frozen inner arrays', () => {
    const out = groupTransfersByDestinationAccount([tr('tr_1', 'acct_a', 100)])
    const bucket = out.get('acct_a')!
    expect(Object.isFrozen(bucket)).toBe(true)
  })
})

// ─── reconcileLeg ────────────────────────────────────────────────────

describe('reconcileLeg — charges leg', () => {
  it('matches all rows, zero drift, when ledger == Stripe', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000), ledger('lg_2', 'ch_2', 2_500)],
      [bt('txn_1', 'ch_1', 1_000), bt('txn_2', 'ch_2', 2_500)],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(2)
    expect(r.missingInStripe).toEqual([])
    expect(r.missingInSettlegrid).toEqual([])
    expect(r.amountMismatch).toEqual([])
    expect(r.totalLedgerCents).toBe(3_500)
    expect(r.totalStripeCents).toBe(3_500)
    expect(r.driftCents).toBe(0)
    expect(r.driftBps).toBe(0)
  })

  it('flags missing-in-Stripe when the ledger has rows Stripe never recorded', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000), ledger('lg_2', 'ch_2', 2_000)],
      [bt('txn_1', 'ch_1', 1_000)],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.missingInStripe).toEqual([
      { ledgerId: 'lg_2', externalRef: 'ch_2', amountCents: 2_000 },
    ])
  })

  it('flags missing-in-SettleGrid when Stripe has rows the ledger never wrote', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000)],
      [bt('txn_1', 'ch_1', 1_000), bt('txn_2', 'ch_2', 999)],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.missingInSettlegrid).toEqual([{ stripeId: 'ch_2', amountCents: 999 }])
  })

  it('flags amount mismatches with signed delta', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000)],
      [bt('txn_1', 'ch_1', 950)],
      'charges',
      '2026-04-24',
    )
    expect(r.amountMismatch).toEqual([
      {
        ledgerId: 'lg_1',
        externalRef: 'ch_1',
        ledgerCents: 1_000,
        stripeCents: 950,
        deltaCents: 50,
      },
    ])
    expect(r.matchedCount).toBe(0)
  })

  it('treats null externalRef as missing-in-Stripe (rail flip never happened)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', null, 1_000)],
      [bt('txn_1', 'ch_1', 1_000)],
      'charges',
      '2026-04-24',
    )
    expect(r.missingInStripe).toEqual([
      { ledgerId: 'lg_1', externalRef: null, amountCents: 1_000 },
    ])
    expect(r.missingInSettlegrid).toEqual([{ stripeId: 'ch_1', amountCents: 1_000 }])
  })

  it('handles balance-txn `source` as expanded object {id}', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000)],
      [
        {
          id: 'txn_1',
          amount: 1_000,
          currency: 'usd',
          type: 'charge',
          source: { id: 'ch_1' },
          created: 1_700_000_000,
          net: 1_000,
        },
      ],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
  })

  it('skips balance txns whose source is null (orphans)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000)],
      [bt('txn_1', 'ch_1', 1_000), bt('txn_orphan', null, 99)],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    // Orphan must not appear in either side of the report.
    expect(r.missingInSettlegrid).toEqual([])
    expect(r.totalStripeCents).toBe(1_000)
  })

  it('rejects non-integer ledger amounts (cents-only contract)', () => {
    expect(() =>
      reconcileLeg(
        [ledger('lg_1', 'ch_1', 100.5)],
        [bt('txn_1', 'ch_1', 100)],
        'charges',
        '2026-04-24',
      ),
    ).toThrow(/non-integer or negative amountCents/)
  })

  it('rejects non-integer Stripe amounts', () => {
    expect(() =>
      reconcileLeg(
        [ledger('lg_1', 'ch_1', 100)],
        [bt('txn_1', 'ch_1', 100.25)],
        'charges',
        '2026-04-24',
      ),
    ).toThrow(/non-integer amount/)
  })

  it('returns frozen reports + frozen array fields', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 1_000)],
      [bt('txn_1', 'ch_1', 1_000)],
      'charges',
      '2026-04-24',
    )
    expect(Object.isFrozen(r)).toBe(true)
    expect(Object.isFrozen(r.missingInStripe)).toBe(true)
    expect(Object.isFrozen(r.missingInSettlegrid)).toBe(true)
    expect(Object.isFrozen(r.amountMismatch)).toBe(true)
  })

  it('rejects invalid `leg` value', () => {
    expect(() =>
      // @ts-expect-error — deliberately wrong leg
      reconcileLeg([], [], 'wat', '2026-04-24'),
    ).toThrow(/'charges' or 'transfers'/)
  })

  it('rejects malformed `dateUtc`', () => {
    expect(() => reconcileLeg([], [], 'charges', '4/24/2026')).toThrow(
      /must be 'YYYY-MM-DD'/,
    )
  })
})

describe('reconcileLeg — transfers leg (partial-payout retries)', () => {
  it('sums multiple transfers per destination before comparing', () => {
    // Single ledger row of $20 paid out via $15 (failed) + $5 retry = $20.
    const r = reconcileLeg(
      [ledger('lg_1', 'acct_a', 2_000)],
      [tr('tr_1', 'acct_a', 1_500), tr('tr_2', 'acct_a', 500)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.amountMismatch).toEqual([])
    expect(r.driftCents).toBe(0)
  })

  it('flags amount mismatch when the per-destination sum differs from ledger', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'acct_a', 2_000)],
      [tr('tr_1', 'acct_a', 1_500), tr('tr_2', 'acct_a', 400)],
      'transfers',
      '2026-04-24',
    )
    expect(r.amountMismatch).toHaveLength(1)
    expect(r.amountMismatch[0].deltaCents).toBe(100)
    expect(r.matchedCount).toBe(0)
  })

  it('drops null-destination transfers from the index (does not reconcile blind)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'acct_a', 1_000)],
      [tr('tr_1', 'acct_a', 1_000), tr('tr_orphan', null, 99)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.missingInSettlegrid).toEqual([])
    expect(r.totalStripeCents).toBe(1_000)
  })

  it('sums BOTH sides per destination — multiple ledger rows + multiple transfers reconcile cleanly', () => {
    // 3 ledger rows × $100 to the same destination, paid out as 1
    // bulk transfer of $300. Without ledger-side summing, this would
    // produce 3 phantom mismatches; with it, the totals reconcile to
    // a single match.
    const r = reconcileLeg(
      [
        ledger('lg_1', 'acct_a', 100),
        ledger('lg_2', 'acct_a', 100),
        ledger('lg_3', 'acct_a', 100),
      ],
      [tr('tr_1', 'acct_a', 300)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.amountMismatch).toEqual([])
    expect(r.totalLedgerCents).toBe(300)
    expect(r.totalStripeCents).toBe(300)
    expect(r.driftCents).toBe(0)
  })

  it('mismatch is reported once per destination with all ledger row ids joined', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'acct_a', 100), ledger('lg_2', 'acct_a', 100)],
      [tr('tr_1', 'acct_a', 150)], // 50 short
      'transfers',
      '2026-04-24',
    )
    expect(r.amountMismatch).toHaveLength(1)
    expect(r.amountMismatch[0].externalRef).toBe('acct_a')
    expect(r.amountMismatch[0].ledgerCents).toBe(200)
    expect(r.amountMismatch[0].stripeCents).toBe(150)
    expect(r.amountMismatch[0].deltaCents).toBe(50)
    expect(r.amountMismatch[0].ledgerId).toContain('lg_1')
    expect(r.amountMismatch[0].ledgerId).toContain('lg_2')
  })

  it('resolves a `tr_*` externalRef to its destination via the day Stripe rows', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'tr_xyz', 1_000)],
      [tr('tr_xyz', 'acct_a', 1_000)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.missingInStripe).toEqual([])
    expect(r.driftCents).toBe(0)
  })

  it('an unknown `tr_*` externalRef surfaces as missing-in-Stripe (no silent drop)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'tr_unknown', 1_000)],
      [tr('tr_real', 'acct_a', 1_000)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(0)
    expect(r.missingInStripe).toHaveLength(1)
    expect(r.missingInStripe[0].externalRef).toBe('tr_unknown')
    // The unmatched Stripe row still surfaces as missing-in-SettleGrid.
    expect(r.missingInSettlegrid).toHaveLength(1)
    expect(r.missingInSettlegrid[0].stripeId).toBe('acct_a')
  })

  it('a non-acct_/non-tr_ externalRef is unresolvable (surfaces in missing-in-Stripe)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'weird_ref', 1_000)],
      [tr('tr_1', 'acct_a', 1_000)],
      'transfers',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(0)
    expect(r.missingInStripe[0].externalRef).toBe('weird_ref')
  })

  it('missing-in-Stripe surfaces each ledger row at its ACTUAL amount, not an averaged value', () => {
    // 3 ledger rows with DIFFERENT amounts to a single destination
    // that Stripe never paid out → 3 distinct missing-in-Stripe
    // entries, each with the row's true amount.
    const r = reconcileLeg(
      [
        ledger('lg_a', 'acct_z', 100),
        ledger('lg_b', 'acct_z', 250),
        ledger('lg_c', 'acct_z', 50),
      ],
      [],
      'transfers',
      '2026-04-24',
    )
    expect(r.missingInStripe).toHaveLength(3)
    const byId = new Map(r.missingInStripe.map((m) => [m.ledgerId, m.amountCents]))
    expect(byId.get('lg_a')).toBe(100)
    expect(byId.get('lg_b')).toBe(250)
    expect(byId.get('lg_c')).toBe(50)
  })

  it('matchedLedgerRowCount counts ledger rows in matched destinations (not destinations)', () => {
    // 3 ledger rows summing to a single matched destination = 3.
    const clean = reconcileLeg(
      [
        ledger('lg_1', 'acct_a', 100),
        ledger('lg_2', 'acct_a', 100),
        ledger('lg_3', 'acct_a', 100),
      ],
      [tr('tr_1', 'acct_a', 300)],
      'transfers',
      '2026-04-24',
    )
    expect(clean.matchedCount).toBe(1)
    expect(clean.matchedLedgerRowCount).toBe(3)

    // Matched destination + an unmatched destination → only the
    // matched bucket's rows contribute to matchedLedgerRowCount.
    const mixed = reconcileLeg(
      [
        ledger('lg_a', 'acct_a', 100),
        ledger('lg_b', 'acct_a', 100),
        ledger('lg_c', 'acct_b', 100), // wrong amount
      ],
      [tr('tr_a', 'acct_a', 200), tr('tr_b', 'acct_b', 999)],
      'transfers',
      '2026-04-24',
    )
    expect(mixed.matchedCount).toBe(1) // only acct_a
    expect(mixed.matchedLedgerRowCount).toBe(2) // lg_a + lg_b
  })

  it('rejects a non-integer transfer amount on the transfers leg (cents-only contract)', () => {
    expect(() =>
      reconcileLeg(
        [ledger('lg_1', 'acct_a', 100)],
        [
          {
            id: 'tr_1',
            amount: 100.5,
            currency: 'usd',
            destination: 'acct_a',
            created: 1_700_000_000,
          },
        ],
        'transfers',
        '2026-04-24',
      ),
    ).toThrow(/non-integer amount/)
  })

  it('charges leg sums multiple balance txns sharing the same source charge', () => {
    // Same `source: 'ch_1'` appears twice in the day (e.g., a charge
    // capture +100 and a Stripe-fee debit -3 net out to 97 cents on
    // that charge). buildChargesIndex sums them so the ledger row's
    // amount can be reconciled against the per-charge total.
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 97)],
      [
        bt('txn_capture', 'ch_1', 100),
        bt('txn_fee', 'ch_1', -3),
      ],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(1)
    expect(r.amountMismatch).toEqual([])
    expect(r.totalStripeCents).toBe(97)
  })

  it('charges leg matchedLedgerRowCount equals matchedCount (1:1 join)', () => {
    const r = reconcileLeg(
      [ledger('lg_1', 'ch_1', 100), ledger('lg_2', 'ch_2', 200)],
      [bt('txn_1', 'ch_1', 100), bt('txn_2', 'ch_2', 200)],
      'charges',
      '2026-04-24',
    )
    expect(r.matchedCount).toBe(2)
    expect(r.matchedLedgerRowCount).toBe(2)
  })

  it('null externalRef on transfers leg surfaces as missing-in-Stripe', () => {
    const r = reconcileLeg(
      [ledger('lg_1', null, 500)],
      [tr('tr_1', 'acct_a', 1_000)],
      'transfers',
      '2026-04-24',
    )
    expect(r.missingInStripe[0].externalRef).toBeNull()
    expect(r.missingInSettlegrid[0].stripeId).toBe('acct_a')
  })
})

// ─── resolveTransfersLedgerDestination ───────────────────────────────

describe('resolveTransfersLedgerDestination', () => {
  it('returns acct_* externalRefs unchanged', () => {
    expect(resolveTransfersLedgerDestination('acct_x', new Map())).toBe('acct_x')
  })

  it('resolves tr_* externalRefs via the lookup map', () => {
    const map = new Map([['tr_x', 'acct_a']])
    expect(resolveTransfersLedgerDestination('tr_x', map)).toBe('acct_a')
  })

  it('returns null for unknown tr_* (failed-transfer with no successful retry yet)', () => {
    expect(resolveTransfersLedgerDestination('tr_missing', new Map())).toBeNull()
  })

  it('returns null for null / non-string / weird shapes', () => {
    expect(resolveTransfersLedgerDestination(null, new Map())).toBeNull()
    expect(resolveTransfersLedgerDestination('', new Map())).toBeNull()
    expect(resolveTransfersLedgerDestination('charge_x', new Map())).toBeNull()
  })
})

// ─── computeDriftBps ─────────────────────────────────────────────────

describe('computeDriftBps', () => {
  it('returns 0 when denominator is 0 (no activity day)', () => {
    expect(computeDriftBps(0, 0)).toBe(0)
  })

  it('uses integer arithmetic — Math.round((cents * 10000) / denom)', () => {
    // 1 cent drift on $100 (10_000 cents) = 1 bp.
    expect(computeDriftBps(1, 10_000)).toBe(1)
    // $1 drift (100 cents) on $100 = 100 bps = 1%.
    expect(computeDriftBps(100, 10_000)).toBe(100)
    // $100 drift on $100 = 10000 bps = 100%.
    expect(computeDriftBps(10_000, 10_000)).toBe(10_000)
  })

  it('rounds half-up (Math.round) so 0.5 bp shows as 1', () => {
    // 1 cent drift on $200 = 0.5 bp → rounds to 1.
    expect(computeDriftBps(1, 20_000)).toBe(1)
  })

  it('rejects negative cents and non-integer args', () => {
    expect(() => computeDriftBps(-1, 100)).toThrow(TypeError)
    expect(() => computeDriftBps(0.5, 100)).toThrow(TypeError)
    expect(() => computeDriftBps(1, -100)).toThrow(TypeError)
    expect(() => computeDriftBps(1, 100.5)).toThrow(TypeError)
  })
})

// ─── shouldOpenIssue ─────────────────────────────────────────────────

function reportFor(overrides: Partial<DriftReport> = {}): DriftReport {
  const base: DriftReport = {
    dateUtc: '2026-04-24',
    leg: 'charges',
    ledgerRowCount: 1,
    stripeRowCount: 1,
    matchedCount: 1,
    matchedLedgerRowCount: 1,
    missingInStripe: [],
    missingInSettlegrid: [],
    amountMismatch: [],
    totalLedgerCents: 1_000,
    totalStripeCents: 1_000,
    driftCents: 0,
    driftBps: 0,
  }
  return Object.freeze({ ...base, ...overrides })
}

describe('shouldOpenIssue', () => {
  it('returns open=false when no leg shows any drift signal', () => {
    const r = shouldOpenIssue([reportFor()], null)
    expect(r.open).toBe(false)
    expect(r.reason).toMatch(/no drift signal/)
  })

  it('returns open=true when driftBps strictly exceeds threshold (default 100bps)', () => {
    const r = shouldOpenIssue([reportFor({ driftBps: 101 })], null)
    expect(r.open).toBe(true)
    expect(r.reason).toMatch(/drift_bps=101/)
  })

  it('does NOT open at exactly the threshold (strict > comparison)', () => {
    const r = shouldOpenIssue([reportFor({ driftBps: 100 })], null)
    expect(r.open).toBe(false)
  })

  it('opens when there is any missingInStripe row (even with zero bps)', () => {
    const r = shouldOpenIssue(
      [
        reportFor({
          missingInStripe: [{ ledgerId: 'lg_1', externalRef: 'ch_1', amountCents: 50 }],
        }),
      ],
      null,
    )
    expect(r.open).toBe(true)
    expect(r.reason).toMatch(/missing_in_stripe=1/)
  })

  it('rate-limits within 24h window (default)', () => {
    const lastIssue = '2026-04-24T08:00:00.000Z'
    const now = '2026-04-24T14:00:00.000Z' // 6h later
    const r = shouldOpenIssue([reportFor({ driftBps: 200 })], lastIssue, {
      nowIso: now,
    })
    expect(r.open).toBe(false)
    expect(r.reason).toMatch(/rate-limited/)
  })

  it('opens once 24h has elapsed since the last issue', () => {
    const lastIssue = '2026-04-23T08:00:00.000Z'
    const now = '2026-04-24T08:00:01.000Z' // just past 24h
    const r = shouldOpenIssue([reportFor({ driftBps: 200 })], lastIssue, {
      nowIso: now,
    })
    expect(r.open).toBe(true)
  })

  it('respects custom rate-limit window', () => {
    const lastIssue = '2026-04-24T00:00:00.000Z'
    const now = '2026-04-24T02:00:00.000Z' // 2h later
    const tight = shouldOpenIssue([reportFor({ driftBps: 200 })], lastIssue, {
      nowIso: now,
      rateLimitHours: 1,
    })
    expect(tight.open).toBe(true)
    const loose = shouldOpenIssue([reportFor({ driftBps: 200 })], lastIssue, {
      nowIso: now,
      rateLimitHours: 6,
    })
    expect(loose.open).toBe(false)
  })

  it('fails open on unparseable lastIssueAtIso (better one extra issue than swallow drift)', () => {
    const r = shouldOpenIssue([reportFor({ driftBps: 200 })], 'not-a-date', {
      nowIso: '2026-04-24T08:00:00.000Z',
    })
    expect(r.open).toBe(true)
  })

  it('rejects malformed thresholdBps / rateLimitHours', () => {
    expect(() =>
      shouldOpenIssue([reportFor()], null, { thresholdBps: -1 }),
    ).toThrow(TypeError)
    expect(() =>
      shouldOpenIssue([reportFor()], null, { thresholdBps: 1.5 }),
    ).toThrow(TypeError)
    expect(() =>
      shouldOpenIssue([reportFor()], null, { rateLimitHours: -1 }),
    ).toThrow(TypeError)
    expect(() =>
      shouldOpenIssue([reportFor()], null, { rateLimitHours: Infinity }),
    ).toThrow(TypeError)
  })

  it('breaks on the first triggering report (does not double-fire reasons)', () => {
    const r = shouldOpenIssue(
      [
        reportFor({ driftBps: 0 }), // clean
        reportFor({ leg: 'transfers', driftBps: 200 }), // dirty
      ],
      null,
    )
    expect(r.open).toBe(true)
    expect(r.reason).toMatch(/transfers/)
  })
})

// ─── formatReconcileSummary ──────────────────────────────────────────

describe('formatReconcileSummary', () => {
  it('emits a multi-line summary with per-leg totals + drift bps', () => {
    const summary = formatReconcileSummary([
      reportFor({ totalLedgerCents: 12_345, totalStripeCents: 12_345 }),
      reportFor({
        leg: 'transfers',
        ledgerRowCount: 3,
        matchedCount: 2,
        amountMismatch: [
          {
            ledgerId: 'lg_x',
            externalRef: 'acct_x',
            ledgerCents: 100,
            stripeCents: 90,
            deltaCents: 10,
          },
        ],
        driftBps: 13,
      }),
    ])
    expect(summary).toContain('Stripe reconciliation — 2026-04-24 UTC:')
    expect(summary).toContain('charges:')
    expect(summary).toContain('transfers:')
    expect(summary).toContain('drift=0bps')
    expect(summary).toContain('drift=13bps')
    expect(summary).toContain('mismatches=1')
    expect(summary).toContain('$123.45')
  })

  it('handles empty input (script ran but produced no output)', () => {
    const summary = formatReconcileSummary([])
    expect(summary).toMatch(/no reports/)
  })

  it('formats negative totals (refund-heavy day) with a leading minus sign', () => {
    // A day where Stripe refunded more than it charged → totalStripeCents
    // can go negative (capture +100 + refund -200 = -100). The formatter
    // must surface the sign so the operator knows the polarity.
    const summary = formatReconcileSummary([
      reportFor({ totalStripeCents: -123 }),
    ])
    expect(summary).toContain('stripe=-$1.23')
  })
})
