/**
 * P3.RAIL3 — Pure-function tests for the Stripe payout-schedule and
 * chargeback-velocity helpers in `packages/rails/src/stripe.ts`.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  CHARGEBACK_GREEN_RATE,
  CHARGEBACK_STRIPE_INTERVENTION_RATE,
  CHARGEBACK_YELLOW_RATE,
  InvalidPayoutScheduleError,
  MIN_CHARGES_FOR_VELOCITY_ALERT,
  classifyChargebackVelocity,
  normalizePayoutSchedule,
  payoutSchedulesEqual,
  shouldSendChargebackAlert,
  updatePayoutSchedule,
  type DesiredPayoutSchedule,
  type StripePayoutClient,
  type StripePayoutSchedule,
} from '../stripe'

// ─── Constants sanity ────────────────────────────────────────────────

describe('chargeback rate constants', () => {
  it('green < yellow < stripe-intervention', () => {
    expect(CHARGEBACK_GREEN_RATE).toBeLessThan(CHARGEBACK_YELLOW_RATE)
    expect(CHARGEBACK_YELLOW_RATE).toBeLessThan(CHARGEBACK_STRIPE_INTERVENTION_RATE)
  })

  it('default sample-size minimum suppresses 1-of-2 chargeback noise', () => {
    expect(MIN_CHARGES_FOR_VELOCITY_ALERT).toBeGreaterThanOrEqual(10)
  })
})

// ─── normalizePayoutSchedule ─────────────────────────────────────────

describe('normalizePayoutSchedule', () => {
  it('passes through manual', () => {
    expect(normalizePayoutSchedule({ interval: 'manual' })).toEqual({
      interval: 'manual',
    })
  })

  it('passes through daily', () => {
    expect(normalizePayoutSchedule({ interval: 'daily' })).toEqual({
      interval: 'daily',
    })
  })

  it('maps weekly weekday → weekly_anchor', () => {
    expect(
      normalizePayoutSchedule({ interval: 'weekly', weekday: 'wednesday' }),
    ).toEqual({ interval: 'weekly', weekly_anchor: 'wednesday' })
  })

  it('maps monthly monthDay → monthly_anchor', () => {
    expect(normalizePayoutSchedule({ interval: 'monthly', monthDay: 15 })).toEqual({
      interval: 'monthly',
      monthly_anchor: 15,
    })
  })

  it('rejects missing interval', () => {
    expect(() =>
      // @ts-expect-error — deliberately wrong shape
      normalizePayoutSchedule({}),
    ).toThrow(InvalidPayoutScheduleError)
  })

  it('rejects unsupported interval', () => {
    expect(() =>
      // @ts-expect-error — deliberately wrong shape
      normalizePayoutSchedule({ interval: 'biweekly' }),
    ).toThrow(/interval must be/)
  })

  it('rejects weekly without weekday', () => {
    expect(() =>
      // @ts-expect-error — deliberately wrong shape
      normalizePayoutSchedule({ interval: 'weekly' }),
    ).toThrow(/requires `weekday`/)
  })

  it('rejects weekly with bogus weekday', () => {
    expect(() =>
      normalizePayoutSchedule({
        interval: 'weekly',
        weekday: 'frunday' as never,
      }),
    ).toThrow(/requires `weekday`/)
  })

  it('rejects monthly with monthDay 0', () => {
    expect(() =>
      normalizePayoutSchedule({ interval: 'monthly', monthDay: 0 }),
    ).toThrow(/integer.*monthDay.*\[1, 31\]/)
  })

  it('rejects monthly with monthDay 32', () => {
    expect(() =>
      normalizePayoutSchedule({ interval: 'monthly', monthDay: 32 }),
    ).toThrow(/integer.*monthDay.*\[1, 31\]/)
  })

  it('rejects monthly with non-integer monthDay', () => {
    expect(() =>
      normalizePayoutSchedule({ interval: 'monthly', monthDay: 15.5 }),
    ).toThrow(/integer.*monthDay/)
  })
})

// ─── payoutSchedulesEqual ────────────────────────────────────────────

describe('payoutSchedulesEqual', () => {
  it('returns false on null inputs', () => {
    expect(payoutSchedulesEqual(null, { interval: 'daily' })).toBe(false)
    expect(payoutSchedulesEqual({ interval: 'daily' }, null)).toBe(false)
    expect(payoutSchedulesEqual(null, null)).toBe(false)
  })

  it('matches manual + daily by interval alone', () => {
    expect(
      payoutSchedulesEqual({ interval: 'manual' }, { interval: 'manual' }),
    ).toBe(true)
    expect(
      payoutSchedulesEqual({ interval: 'daily' }, { interval: 'daily' }),
    ).toBe(true)
    expect(
      payoutSchedulesEqual({ interval: 'manual' }, { interval: 'daily' }),
    ).toBe(false)
  })

  it('weekly compares weekly_anchor', () => {
    expect(
      payoutSchedulesEqual(
        { interval: 'weekly', weekly_anchor: 'monday' },
        { interval: 'weekly', weekly_anchor: 'monday' },
      ),
    ).toBe(true)
    expect(
      payoutSchedulesEqual(
        { interval: 'weekly', weekly_anchor: 'monday' },
        { interval: 'weekly', weekly_anchor: 'tuesday' },
      ),
    ).toBe(false)
  })

  it('monthly compares monthly_anchor', () => {
    expect(
      payoutSchedulesEqual(
        { interval: 'monthly', monthly_anchor: 1 },
        { interval: 'monthly', monthly_anchor: 1 },
      ),
    ).toBe(true)
    expect(
      payoutSchedulesEqual(
        { interval: 'monthly', monthly_anchor: 1 },
        { interval: 'monthly', monthly_anchor: 15 },
      ),
    ).toBe(false)
  })

  it('ignores delay_days when comparing', () => {
    expect(
      payoutSchedulesEqual(
        { interval: 'daily', delay_days: 7 },
        { interval: 'daily', delay_days: 'minimum' },
      ),
    ).toBe(true)
  })
})

// ─── updatePayoutSchedule (idempotency — hostile (a)) ───────────────

function fakeClient(
  current: StripePayoutSchedule | null,
): StripePayoutClient & {
  updateCalls: number
  retrieveCalls: number
  lastUpdate?: StripePayoutSchedule
} {
  const state: { current: StripePayoutSchedule | null } = { current }
  let updateCalls = 0
  let retrieveCalls = 0
  let lastUpdate: StripePayoutSchedule | undefined
  const c: StripePayoutClient & {
    updateCalls: number
    retrieveCalls: number
    lastUpdate?: StripePayoutSchedule
  } = {
    accounts: {
      retrieve: async (id: string) => {
        retrieveCalls++
        c.retrieveCalls = retrieveCalls
        return { id, settings: { payouts: { schedule: state.current ?? undefined } } }
      },
      update: async (id, params) => {
        updateCalls++
        c.updateCalls = updateCalls
        lastUpdate = params.settings.payouts.schedule
        c.lastUpdate = lastUpdate
        state.current = params.settings.payouts.schedule
        return { id, settings: { payouts: { schedule: state.current } } }
      },
    },
    updateCalls,
    retrieveCalls,
  }
  return c
}

describe('updatePayoutSchedule', () => {
  it('skips the Stripe call when caller-supplied current matches desired', async () => {
    const c = fakeClient(null)
    const r = await updatePayoutSchedule(
      c,
      'acct_x',
      { interval: 'weekly', weekday: 'monday' },
      { interval: 'weekly', weekly_anchor: 'monday' },
    )
    expect(r.updated).toBe(false)
    expect(r.reason).toBe('already-current')
    expect(c.updateCalls).toBe(0)
    expect(c.retrieveCalls).toBe(0)
  })

  it('retrieves the account when currentSchedule is omitted, then no-ops if equal', async () => {
    const c = fakeClient({ interval: 'daily' })
    const r = await updatePayoutSchedule(c, 'acct_x', { interval: 'daily' })
    expect(r.updated).toBe(false)
    expect(c.retrieveCalls).toBe(1)
    expect(c.updateCalls).toBe(0)
  })

  it('calls update once when desired differs from current', async () => {
    const c = fakeClient({ interval: 'daily' })
    const r = await updatePayoutSchedule(c, 'acct_x', {
      interval: 'monthly',
      monthDay: 5,
    })
    expect(r.updated).toBe(true)
    expect(c.updateCalls).toBe(1)
    expect(c.lastUpdate).toEqual({ interval: 'monthly', monthly_anchor: 5 })
    expect(r.schedule).toEqual({ interval: 'monthly', monthly_anchor: 5 })
  })

  it('a double-submit collapses to ONE Stripe update + zero further calls', async () => {
    const c = fakeClient({ interval: 'daily' })
    const r1 = await updatePayoutSchedule(c, 'acct_x', { interval: 'daily' })
    const r2 = await updatePayoutSchedule(c, 'acct_x', { interval: 'daily' })
    expect(r1.updated).toBe(false)
    expect(r2.updated).toBe(false)
    expect(c.updateCalls).toBe(0)
    // retrieve fires twice (no caller-supplied current); that's fine —
    // it's a read-only call and Stripe's no-op write is also harmless.
    expect(c.retrieveCalls).toBe(2)
  })

  it('throws when the Stripe response schedule does not match what we sent', async () => {
    const broken: StripePayoutClient = {
      accounts: {
        retrieve: async (id) => ({ id, settings: { payouts: { schedule: { interval: 'daily' } } } }),
        update: async (id) => ({
          id,
          settings: { payouts: { schedule: { interval: 'daily' } } }, // ignores our request
        }),
      },
    }
    await expect(
      updatePayoutSchedule(broken, 'acct_x', { interval: 'monthly', monthDay: 1 }),
    ).rejects.toThrow(/does not match/)
  })

  it('throws on missing accountId', async () => {
    const c = fakeClient(null)
    await expect(
      updatePayoutSchedule(c, '', { interval: 'daily' }),
    ).rejects.toThrow(InvalidPayoutScheduleError)
  })

  it('propagates InvalidPayoutScheduleError from normalize', async () => {
    const c = fakeClient(null)
    await expect(
      updatePayoutSchedule(c, 'acct_x', {
        interval: 'monthly',
        monthDay: 50,
      } as DesiredPayoutSchedule),
    ).rejects.toThrow(InvalidPayoutScheduleError)
  })
})

// ─── classifyChargebackVelocity (hostile (b)) ───────────────────────

describe('classifyChargebackVelocity', () => {
  function inputs(
    chargesCount: number,
    chargebacksCount: number,
    chargesVolumeCents = 100_000,
    chargebacksVolumeCents = 0,
  ) {
    return {
      chargesCount,
      chargebacksCount,
      chargesVolumeCents,
      chargebacksVolumeCents,
    }
  }

  it('zero charges → green, no division by zero', () => {
    const r = classifyChargebackVelocity(inputs(0, 0, 0, 0))
    expect(r.tier).toBe('green')
    expect(r.rateByCount).toBe(0)
    expect(r.rateByVolume).toBe(0)
    expect(r.suppressedByLowSampleSize).toBe(false)
  })

  it('1-of-2 chargebacks NEVER fires (low-sample-size guard)', () => {
    const r = classifyChargebackVelocity(inputs(2, 1, 200, 100))
    expect(r.tier).toBe('green')
    expect(r.suppressedByLowSampleSize).toBe(true)
    expect(r.reason).toMatch(/low sample size/)
    // The classifier should record that the candidate WAS red.
    expect(r.reason).toMatch(/would otherwise be red/)
  })

  it('green when both rates are at or below the green threshold', () => {
    // 3 chargebacks out of 1000 = 0.3% rate by count.
    const r = classifyChargebackVelocity(inputs(1000, 3, 100_000, 300))
    expect(r.tier).toBe('green')
    expect(r.suppressedByLowSampleSize).toBe(false)
  })

  it('yellow at 0.3% < rate ≤ 0.5%', () => {
    // 4 chargebacks out of 1000 = 0.4% by count.
    const r = classifyChargebackVelocity(inputs(1000, 4))
    expect(r.tier).toBe('yellow')
  })

  it('red at rate > 0.5%', () => {
    // 6 chargebacks out of 1000 = 0.6% by count.
    const r = classifyChargebackVelocity(inputs(1000, 6))
    expect(r.tier).toBe('red')
  })

  it('uses worst of (rateByCount, rateByVolume)', () => {
    // 1 chargeback of $9000 out of 200 charges totaling $10,000 →
    // rateByCount=0.5%, rateByVolume=90%.
    const r = classifyChargebackVelocity(inputs(200, 1, 1_000_000, 900_000))
    expect(r.tier).toBe('red')
    expect(r.rateByVolume).toBeGreaterThan(0.5)
  })

  it('rejects negative counts', () => {
    expect(() =>
      classifyChargebackVelocity(inputs(-1, 0, 0, 0)),
    ).toThrow(TypeError)
  })

  it('rejects fractional counts', () => {
    expect(() =>
      classifyChargebackVelocity(inputs(10.5, 1, 100, 10)),
    ).toThrow(TypeError)
  })

  it('rejects negative volumes', () => {
    expect(() =>
      classifyChargebackVelocity({
        chargesCount: 100,
        chargebacksCount: 1,
        chargesVolumeCents: -1,
        chargebacksVolumeCents: 0,
      }),
    ).toThrow(TypeError)
  })

  it('rejects yellow > red threshold ordering', () => {
    expect(() =>
      classifyChargebackVelocity(inputs(100, 1), {
        yellowThreshold: 0.5,
        redThreshold: 0.1,
      }),
    ).toThrow(TypeError)
  })

  it('respects custom minChargesForAlert override', () => {
    const r = classifyChargebackVelocity(inputs(5, 1, 500, 100), {
      minChargesForAlert: 5,
    })
    // 5 charges meets the (overridden) sample-size minimum, 20% rate → red.
    expect(r.tier).toBe('red')
    expect(r.suppressedByLowSampleSize).toBe(false)
  })

  it('returns frozen result', () => {
    const r = classifyChargebackVelocity(inputs(100, 1))
    expect(Object.isFrozen(r)).toBe(true)
  })
})

// ─── shouldSendChargebackAlert (hostile (d)) ────────────────────────

describe('shouldSendChargebackAlert', () => {
  it('green tier never fires', () => {
    const r = shouldSendChargebackAlert('green', [])
    expect(r.open).toBe(false)
    expect(r.reason).toMatch(/never alerts/)
  })

  it('yellow with no prior alerts → open', () => {
    const r = shouldSendChargebackAlert('yellow', [])
    expect(r.open).toBe(true)
  })

  it('yellow rate-limited within 7 days', () => {
    const r = shouldSendChargebackAlert(
      'yellow',
      [{ tier: 'yellow', emittedAtIso: '2026-04-22T00:00:00.000Z' }],
      { nowIso: '2026-04-25T00:00:00.000Z' },
    )
    expect(r.open).toBe(false)
    expect(r.reason).toMatch(/rate-limited/)
  })

  it('yellow opens after 7 days', () => {
    const r = shouldSendChargebackAlert(
      'yellow',
      [{ tier: 'yellow', emittedAtIso: '2026-04-15T00:00:00.000Z' }],
      { nowIso: '2026-04-25T00:00:00.000Z' },
    )
    expect(r.open).toBe(true)
  })

  it('red rate-limited within 24h', () => {
    const r = shouldSendChargebackAlert(
      'red',
      [{ tier: 'red', emittedAtIso: '2026-04-25T00:00:00.000Z' }],
      { nowIso: '2026-04-25T08:00:00.000Z' },
    )
    expect(r.open).toBe(false)
  })

  it('red opens after 24h', () => {
    const r = shouldSendChargebackAlert(
      'red',
      [{ tier: 'red', emittedAtIso: '2026-04-23T00:00:00.000Z' }],
      { nowIso: '2026-04-25T08:00:00.000Z' },
    )
    expect(r.open).toBe(true)
  })

  it('yellow + red rate-limit independently', () => {
    // A red alert fired within the past hour; the yellow rate-limit
    // window is 7 days but should NOT be triggered by the red row.
    const history = [{ tier: 'red' as const, emittedAtIso: '2026-04-25T07:00:00.000Z' }]
    const yellow = shouldSendChargebackAlert('yellow', history, {
      nowIso: '2026-04-25T08:00:00.000Z',
    })
    expect(yellow.open).toBe(true)
  })

  it('uses MOST RECENT alert when several rows exist', () => {
    const history = [
      { tier: 'yellow' as const, emittedAtIso: '2026-04-10T00:00:00.000Z' },
      { tier: 'yellow' as const, emittedAtIso: '2026-04-23T00:00:00.000Z' }, // recent
    ]
    const r = shouldSendChargebackAlert('yellow', history, {
      nowIso: '2026-04-25T00:00:00.000Z',
    })
    expect(r.open).toBe(false)
  })

  it('skips unparseable timestamps when finding most recent', () => {
    const history = [
      { tier: 'yellow' as const, emittedAtIso: '2026-04-23T00:00:00.000Z' }, // recent
      { tier: 'yellow' as const, emittedAtIso: 'not-a-date' },
    ]
    const r = shouldSendChargebackAlert('yellow', history, {
      nowIso: '2026-04-25T00:00:00.000Z',
    })
    expect(r.open).toBe(false)
  })

  it('throws on unparseable nowIso', () => {
    expect(() =>
      shouldSendChargebackAlert('yellow', [], { nowIso: 'not-a-date' }),
    ).toThrow(TypeError)
  })

  it('throws on negative window override', () => {
    expect(() =>
      shouldSendChargebackAlert('yellow', [], { yellowWindowHours: -1 }),
    ).toThrow(TypeError)
  })

  it('window override applies', () => {
    // 0 window → never rate-limit, always open
    const r = shouldSendChargebackAlert(
      'yellow',
      [{ tier: 'yellow', emittedAtIso: '2026-04-25T07:59:00.000Z' }],
      { nowIso: '2026-04-25T08:00:00.000Z', yellowWindowHours: 0 },
    )
    expect(r.open).toBe(true)
  })
})

// ─── Stable mocks check (vi.fn smoke) ────────────────────────────────

describe('helpers integration smoke', () => {
  it('integration: classify → rate-limit → email decision', () => {
    // 1/100 charges = 1% rate, sample size 100 ≥ MIN_CHARGES (10),
    // so the classifier flags red.
    const inputs = {
      chargesCount: 100,
      chargebacksCount: 1,
      chargesVolumeCents: 100_000,
      chargebacksVolumeCents: 1_000,
    }
    const cls = classifyChargebackVelocity(inputs)
    expect(cls.tier).toBe('red')

    const decision = shouldSendChargebackAlert(cls.tier, [])
    expect(decision.open).toBe(true)

    // Caller can then choose to dispatch the email — this test just
    // confirms the wiring composes without surprises.
    expect(typeof vi.fn).toBe('function')
  })
})
