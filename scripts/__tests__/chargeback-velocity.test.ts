/**
 * P3.RAIL3 — Smoke tests for the chargeback-velocity orchestration
 * script. Pure-helper coverage lives in
 * `packages/rails/src/__tests__/stripe.test.ts`. These tests verify
 * that the script's wiring (Stripe pagination + DB write injection +
 * email injection) correctly composes the helpers.
 */

import { describe, it, expect, vi } from 'vitest'

import {
  defaultSendEmail,
  evaluateDeveloper,
  fetchChargesFor,
  fetchDisputesIn,
  main,
  makeDefaultFlipPause,
  makeDefaultLoadAlertHistory,
  makeDefaultLoadDevelopers,
  makeDefaultPersistAlert,
  parseArgs,
  renderChargebackAlertTemplate,
  runChargebackVelocity,
  type DeveloperContext,
  type PostgresLikeClient,
  type StripeChargebackClient,
} from '../chargeback-velocity'

// ─── Fixtures ────────────────────────────────────────────────────────

function dev(overrides: Partial<DeveloperContext> = {}): DeveloperContext {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'dev@example.com',
    name: 'Test Developer',
    stripeConnectId: 'acct_test',
    alreadyPaused: false,
    ...overrides,
  }
}

function makeClient(
  charges: Array<Record<string, unknown>>,
  disputes: Array<Record<string, unknown>>,
): StripeChargebackClient {
  return {
    charges: {
      list: async () => ({
        data: charges as unknown as Parameters<
          StripeChargebackClient['charges']['list']
        >[0] extends never
          ? never
          : Awaited<ReturnType<StripeChargebackClient['charges']['list']>>['data'],
        has_more: false,
      }),
    },
    disputes: {
      list: async () => ({
        data: disputes as unknown as Awaited<
          ReturnType<StripeChargebackClient['disputes']['list']>
        >['data'],
        has_more: false,
      }),
    },
  }
}

// ─── parseArgs ───────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('defaults are sane', () => {
    const a = parseArgs([])
    expect(a.dryRun).toBe(false)
    expect(a.windowDays).toBe(30)
    expect(a.minCharges).toBe(10)
    expect(a.developerId).toBeNull()
    expect(a.help).toBe(false)
  })

  it('parses --dry-run + --window-days + --min-charges', () => {
    const a = parseArgs(['--dry-run', '--window-days', '14', '--min-charges', '5'])
    expect(a.dryRun).toBe(true)
    expect(a.windowDays).toBe(14)
    expect(a.minCharges).toBe(5)
  })

  it('rejects --window-days out of range', () => {
    expect(() => parseArgs(['--window-days', '0'])).toThrow(/\[1, 365\]/)
    expect(() => parseArgs(['--window-days', '400'])).toThrow(/\[1, 365\]/)
    expect(() => parseArgs(['--window-days', '7.5'])).toThrow(/\[1, 365\]/)
  })

  it('rejects --min-charges negative', () => {
    expect(() => parseArgs(['--min-charges', '-1'])).toThrow(/non-negative/)
  })

  it('--developer-id requires UUID shape', () => {
    expect(() => parseArgs(['--developer-id', 'not-a-uuid'])).toThrow(/UUID/)
    expect(() => parseArgs(['--developer-id'])).toThrow(/UUID/)
    const ok = parseArgs(['--developer-id', '00000000-0000-0000-0000-000000000001'])
    expect(ok.developerId).toBe('00000000-0000-0000-0000-000000000001')
  })

  it('--help / -h sets the flag', () => {
    expect(parseArgs(['--help']).help).toBe(true)
    expect(parseArgs(['-h']).help).toBe(true)
  })

  it('unknown args throw', () => {
    expect(() => parseArgs(['--foobar'])).toThrow(/Unknown argument/)
  })
})

// ─── fetchChargesFor / fetchDisputesIn pagination ────────────────────

describe('Stripe pagination wrappers', () => {
  it('fetchChargesFor walks pages until has_more=false', async () => {
    let page = 0
    const c: StripeChargebackClient = {
      charges: {
        list: async () => {
          page++
          if (page === 1) {
            return {
              data: [
                { id: 'ch_1', amount: 1000, status: 'succeeded', created: 1, paid: true, refunded: false },
              ] as never,
              has_more: true,
            }
          }
          return {
            data: [
              { id: 'ch_2', amount: 2000, status: 'succeeded', created: 1, paid: true, refunded: false },
            ] as never,
            has_more: false,
          }
        },
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    const out = await fetchChargesFor(c, 'acct_x', 0, 1)
    expect(out.map((x) => x.id)).toEqual(['ch_1', 'ch_2'])
  })

  it('throws on duplicate id (cursor not advancing)', async () => {
    const c: StripeChargebackClient = {
      charges: {
        list: async () =>
          ({
            data: [
              { id: 'ch_dup', amount: 1, status: 'succeeded', created: 1, paid: true, refunded: false },
            ] as never,
            has_more: true,
          }),
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /duplicate id/,
    )
  })

  it('throws on cursor stall (has_more=true with empty data)', async () => {
    const c: StripeChargebackClient = {
      charges: { list: async () => ({ data: [] as never, has_more: true }) },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /cursor stalled/,
    )
  })

  it('disputes list pagination smoke', async () => {
    const c: StripeChargebackClient = {
      charges: { list: async () => ({ data: [], has_more: false }) },
      disputes: {
        list: async () =>
          ({
            data: [{ id: 'dp_1', amount: 100, charge: 'ch_1', created: 1, status: 'won' }] as never,
            has_more: false,
          }),
      },
    }
    const out = await fetchDisputesIn(c, 0, 1)
    expect(out.map((d) => d.id)).toEqual(['dp_1'])
  })
})

// ─── evaluateDeveloper ───────────────────────────────────────────────

describe('evaluateDeveloper', () => {
  it('clean account → green tier, alertSent=skipped', async () => {
    const c = makeClient(
      [
        { id: 'ch_1', amount: 5_000, status: 'succeeded', created: 1, paid: true, refunded: false },
        { id: 'ch_2', amount: 5_000, status: 'succeeded', created: 1, paid: true, refunded: false },
      ],
      [],
    )
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 1,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
    })
    expect(r.classification.tier).toBe('green')
    expect(r.alertSent).toBe('skipped')
    expect(r.paused).toBe(false)
  })

  it('high-rate account → red tier; sendEmail called when configured', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      { id: 'dp_1', amount: 5_000, charge: 'ch_0', created: 1, status: 'lost' },
      { id: 'dp_2', amount: 5_000, charge: 'ch_1', created: 1, status: 'lost' },
    ] // 2/100 = 2% > 0.5%
    const c = makeClient(charges, disputes)
    const sendEmail = vi.fn().mockResolvedValue({ sent: true })
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 10,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
      sendEmail,
    })
    expect(r.classification.tier).toBe('red')
    expect(r.alertSent).toBe('sent')
    expect(r.paused).toBe(true)
    expect(sendEmail).toHaveBeenCalledTimes(1)
    expect(sendEmail.mock.calls[0][0]).toBe('red')
  })

  it('rate-limited red → no email sent, alertSent=rate_limited', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      { id: 'dp_1', amount: 5_000, charge: 'ch_0', created: 1, status: 'lost' },
      { id: 'dp_2', amount: 5_000, charge: 'ch_1', created: 1, status: 'lost' },
    ]
    const c = makeClient(charges, disputes)
    const sendEmail = vi.fn().mockResolvedValue({ sent: true })
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 10,
      history: [{ tier: 'red', emittedAtIso: '2026-04-25T07:30:00.000Z' }], // 1h ago
      nowIso: '2026-04-25T08:30:00.000Z',
      sendEmail,
    })
    expect(r.classification.tier).toBe('red')
    expect(r.alertSent).toBe('rate_limited')
    expect(sendEmail).not.toHaveBeenCalled()
    // Pause still flips because the rate-limit only governs EMAIL,
    // not the underlying onboarding-pause action.
    expect(r.paused).toBe(true)
  })

  it('sendEmail throw → alertSent=failed, no exception', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      { id: 'dp_1', amount: 5_000, charge: 'ch_0', created: 1, status: 'lost' },
    ] // 1% by count (red)
    const c = makeClient(charges, disputes)
    const sendEmail = vi.fn().mockRejectedValue(new Error('resend api down'))
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 10,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
      sendEmail,
    })
    expect(r.alertSent).toBe('failed')
    expect(r.alertSendReason).toMatch(/resend api down/)
  })

  it('disputes whose charge is NOT in this developer\'s charges are filtered out', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      // dp_other points to a charge from a DIFFERENT developer
      { id: 'dp_other', amount: 50_000, charge: 'ch_other_dev', created: 1, status: 'lost' },
    ]
    const c = makeClient(charges, disputes)
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 10,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
    })
    // The dispute should NOT count against this developer.
    expect(r.classification.tier).toBe('green')
    expect(r.inputs.chargebacksCount).toBe(0)
  })

  it('non-succeeded / refunded charges are excluded from the denominator', async () => {
    const c = makeClient(
      [
        { id: 'ch_1', amount: 5_000, status: 'succeeded', created: 1, paid: true, refunded: false },
        { id: 'ch_2', amount: 5_000, status: 'failed', created: 1, paid: false, refunded: false },
        { id: 'ch_3', amount: 5_000, status: 'succeeded', created: 1, paid: true, refunded: true },
      ],
      [],
    )
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 1,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
    })
    expect(r.inputs.chargesCount).toBe(1)
    expect(r.inputs.chargesVolumeCents).toBe(5_000)
  })

  it('handles dispute.charge as expanded {id} object', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 1_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      // expanded shape: dp.charge is { id: 'ch_0' }
      { id: 'dp_1', amount: 1_000, charge: { id: 'ch_0' }, created: 1, status: 'lost' },
    ]
    const c = makeClient(charges, disputes)
    const r = await evaluateDeveloper(c, dev(), {
      windowSec: { startSec: 0, endSec: 1_700_000_000 },
      minCharges: 10,
      history: [],
      nowIso: '2026-04-25T08:30:00.000Z',
    })
    expect(r.inputs.chargebacksCount).toBe(1)
  })
})

// ─── runChargebackVelocity ───────────────────────────────────────────

describe('runChargebackVelocity', () => {
  it('dry-run returns zeros, no Stripe / DB / email calls', async () => {
    const log: string[] = []
    const r = await runChargebackVelocity(
      {
        dryRun: true,
        windowDays: 30,
        minCharges: 10,
        developerId: null,
        help: false,
      },
      { log: (m) => log.push(m) },
    )
    expect(r.evaluated).toBe(0)
    expect(r.yellow).toBe(0)
    expect(r.red).toBe(0)
    expect(log.some((l) => /dry-run/.test(l))).toBe(true)
  })

  it('non-dry-run requires loadDevelopers — throws otherwise', async () => {
    await expect(
      runChargebackVelocity({
        dryRun: false,
        windowDays: 30,
        minCharges: 10,
        developerId: null,
        help: false,
      }),
    ).rejects.toThrow(/loadDevelopers must be provided/)
  })

  it('orchestrates load → evaluate → persistAlert → flipPause', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      { id: 'dp_1', amount: 5_000, charge: 'ch_0', created: 1, status: 'lost' },
      { id: 'dp_2', amount: 5_000, charge: 'ch_1', created: 1, status: 'lost' },
    ]
    const stripeClient = () => makeClient(charges, disputes)

    const persistAlert = vi.fn().mockResolvedValue(undefined)
    const flipPause = vi.fn().mockResolvedValue(undefined)
    const sendEmail = vi.fn().mockResolvedValue({ sent: true })

    const r = await runChargebackVelocity(
      {
        dryRun: false,
        windowDays: 30,
        minCharges: 10,
        developerId: null,
        help: false,
      },
      {
        loadDevelopers: async () => [dev()],
        loadAlertHistory: async () => [],
        persistAlert,
        flipPause,
        sendEmail,
        stripeClient,
        nowIso: '2026-04-25T08:30:00.000Z',
        log: () => {},
      },
    )
    expect(r.evaluated).toBe(1)
    expect(r.red).toBe(1)
    expect(r.paused).toBe(1)
    expect(persistAlert).toHaveBeenCalledTimes(1)
    expect(flipPause).toHaveBeenCalledTimes(1)
    expect(sendEmail).toHaveBeenCalledTimes(1)
  })

  it('does NOT flip pause when developer was already paused', async () => {
    const charges = Array.from({ length: 100 }, (_, i) => ({
      id: `ch_${i}`,
      amount: 5_000,
      status: 'succeeded',
      created: 1,
      paid: true,
      refunded: false,
    }))
    const disputes = [
      { id: 'dp_1', amount: 5_000, charge: 'ch_0', created: 1, status: 'lost' },
      { id: 'dp_2', amount: 5_000, charge: 'ch_1', created: 1, status: 'lost' },
    ]
    const stripeClient = () => makeClient(charges, disputes)
    const flipPause = vi.fn().mockResolvedValue(undefined)
    const r = await runChargebackVelocity(
      {
        dryRun: false,
        windowDays: 30,
        minCharges: 10,
        developerId: null,
        help: false,
      },
      {
        loadDevelopers: async () => [dev({ alreadyPaused: true })],
        loadAlertHistory: async () => [],
        persistAlert: async () => {},
        flipPause,
        sendEmail: async () => ({ sent: true }),
        stripeClient,
        nowIso: '2026-04-25T08:30:00.000Z',
        log: () => {},
      },
    )
    expect(r.red).toBe(1)
    expect(r.paused).toBe(0)
    expect(flipPause).not.toHaveBeenCalled()
  })

  it('errors during evaluation are captured + counted; loop continues', async () => {
    const stripeClient = () => ({
      charges: {
        list: async () => {
          throw new Error('Stripe 500')
        },
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }) as unknown as StripeChargebackClient

    const r = await runChargebackVelocity(
      {
        dryRun: false,
        windowDays: 30,
        minCharges: 10,
        developerId: null,
        help: false,
      },
      {
        loadDevelopers: async () => [dev(), dev({ id: '00000000-0000-0000-0000-000000000002' })],
        stripeClient,
        nowIso: '2026-04-25T08:30:00.000Z',
        log: () => {},
      },
    )
    expect(r.evaluated).toBe(2)
    expect(r.errors).toBe(2)
    expect(r.details).toHaveLength(2)
  })

  it('rejects unparseable nowIso', async () => {
    await expect(
      runChargebackVelocity(
        {
          dryRun: false,
          windowDays: 30,
          minCharges: 10,
          developerId: null,
          help: false,
        },
        {
          loadDevelopers: async () => [],
          nowIso: 'garbage',
        },
      ),
    ).rejects.toThrow(/nowIso unparseable/)
  })
})

// ─── main ────────────────────────────────────────────────────────────

describe('main', () => {
  it('--help prints usage and returns 0', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['--help'])
      expect(code).toBe(0)
      expect(logSpy.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
        /Usage:/,
      )
    } finally {
      logSpy.mockRestore()
    }
  })

  it('--dry-run returns 0 with no Stripe / DB calls', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['--dry-run'])
      expect(code).toBe(0)
    } finally {
      logSpy.mockRestore()
    }
  })

  it('returns 2 on argument-parse error', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    try {
      const code = await main(['--something-else'])
      expect(code).toBe(2)
    } finally {
      errSpy.mockRestore()
      logSpy.mockRestore()
    }
  })

  it('returns 1 when default DB path throws (no DATABASE_URL)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const prev = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const code = await main([])
      expect(code).toBe(1)
    } finally {
      if (prev !== undefined) process.env.DATABASE_URL = prev
      errSpy.mockRestore()
      logSpy.mockRestore()
    }
  })
})

// ─── pagination malformed-response edge cases ────────────────────────

describe('pagination malformed-response guards', () => {
  it('throws when Stripe returns non-array data field', async () => {
    const c: StripeChargebackClient = {
      charges: {
        list: async () =>
          ({
            // intentionally malformed — `data` is not an array
            data: null as unknown as never,
            has_more: false,
          }),
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /malformed response/,
    )
  })

  it('throws when Stripe returns non-boolean has_more field', async () => {
    const c: StripeChargebackClient = {
      charges: {
        list: async () =>
          ({
            data: [],
            // intentionally malformed
            has_more: 'maybe' as unknown as boolean,
          }) as never,
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /malformed response/,
    )
  })

  it('throws when an item lacks a string id', async () => {
    const c: StripeChargebackClient = {
      charges: {
        list: async () =>
          ({
            data: [
              {
                amount: 100,
                status: 'succeeded',
                created: 1,
                paid: true,
                refunded: false,
              },
            ] as unknown as never,
            has_more: false,
          }),
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /missing string `id`/,
    )
  })

  it('throws when an item has empty-string id', async () => {
    const c: StripeChargebackClient = {
      charges: {
        list: async () =>
          ({
            data: [
              {
                id: '',
                amount: 100,
                status: 'succeeded',
                created: 1,
                paid: true,
                refunded: false,
              },
            ] as unknown as never,
            has_more: false,
          }),
      },
      disputes: { list: async () => ({ data: [], has_more: false }) },
    }
    await expect(fetchChargesFor(c, 'acct_x', 0, 1)).rejects.toThrow(
      /missing string `id`/,
    )
  })
})

// ─── renderChargebackAlertTemplate ───────────────────────────────────

describe('renderChargebackAlertTemplate', () => {
  const inputs = {
    chargesCount: 100,
    chargebacksCount: 1,
    chargesVolumeCents: 100_000,
    chargebacksVolumeCents: 1_000,
  }
  const dev: DeveloperContext = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'dev@example.com',
    name: 'Alice',
    stripeConnectId: 'acct_test',
    alreadyPaused: false,
  }

  it('yellow subject mentions 0.3% threshold', () => {
    const t = renderChargebackAlertTemplate('yellow', dev, inputs)
    expect(t.subject).toContain('0.3%')
  })

  it('red subject mentions onboarding pause', () => {
    const t = renderChargebackAlertTemplate('red', dev, inputs)
    expect(t.subject.toLowerCase()).toContain('paused')
  })

  it('greets the developer by name when provided', () => {
    const t = renderChargebackAlertTemplate('yellow', dev, inputs)
    expect(t.html).toContain('Hi Alice')
  })

  it('falls back to "there" when name is null', () => {
    const t = renderChargebackAlertTemplate('yellow', { ...dev, name: null }, inputs)
    expect(t.html).toContain('Hi there')
  })

  it('escapes HTML in the developer name', () => {
    const t = renderChargebackAlertTemplate(
      'yellow',
      { ...dev, name: '<script>x</script>' },
      inputs,
    )
    expect(t.html).not.toContain('<script>x</script>')
    expect(t.html).toContain('&lt;script&gt;x&lt;/script&gt;')
  })

  it('reports the worst-of-rates as a percentage', () => {
    // 1 chargeback / 100 charges = 1.0% by count
    // $10 / $1000 = 1.0% by volume
    const t = renderChargebackAlertTemplate('yellow', dev, inputs)
    expect(t.html).toContain('1.00%')
  })

  it('renders 0% rate cleanly when both counts are zero', () => {
    const zeroInputs = {
      chargesCount: 0,
      chargebacksCount: 0,
      chargesVolumeCents: 0,
      chargebacksVolumeCents: 0,
    }
    const t = renderChargebackAlertTemplate('yellow', dev, zeroInputs)
    expect(t.html).toContain('0.00%')
  })

  it('red template links to the Stripe disputes dashboard', () => {
    const t = renderChargebackAlertTemplate('red', dev, inputs)
    expect(t.html).toContain('https://dashboard.stripe.com/disputes')
  })

  it('yellow template mentions the 7-day rate-limit window', () => {
    const t = renderChargebackAlertTemplate('yellow', dev, inputs)
    expect(t.html).toContain('7 days')
  })

  it('red template mentions the 24-hour rate-limit window', () => {
    const t = renderChargebackAlertTemplate('red', dev, inputs)
    expect(t.html).toContain('24 hours')
  })

  it('formats charge volume as USD', () => {
    const t = renderChargebackAlertTemplate('yellow', dev, inputs)
    expect(t.html).toContain('$1,000.00') // chargesVolumeCents=100000 → $1000
  })
})

// ─── defaultSendEmail ────────────────────────────────────────────────

describe('defaultSendEmail', () => {
  const dev: DeveloperContext = {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'dev@example.com',
    name: 'Alice',
    stripeConnectId: 'acct_test',
    alreadyPaused: false,
  }
  const inputs = {
    chargesCount: 100,
    chargebacksCount: 1,
    chargesVolumeCents: 100_000,
    chargebacksVolumeCents: 1_000,
  }
  const originalFetch = global.fetch
  const originalKey = process.env.RESEND_API_KEY
  const originalFounder = process.env.FOUNDER_EMAIL

  it('returns sent=false when RESEND_API_KEY is missing', async () => {
    delete process.env.RESEND_API_KEY
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const r = await defaultSendEmail('yellow', dev, inputs)
      expect(r.sent).toBe(false)
      expect(warnSpy).toHaveBeenCalled()
    } finally {
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
      warnSpy.mockRestore()
    }
  })

  it('yellow tier sends only to the developer', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    let captured: { url?: string; body?: { to?: string[] }; auth?: string } = {}
    global.fetch = vi.fn(async (url: string, init: { headers?: Record<string, string>; body?: string }) => {
      captured.url = url
      captured.auth = init.headers?.Authorization
      captured.body = init.body ? JSON.parse(init.body as string) : undefined
      return { ok: true, status: 200, text: async () => 'ok' } as Response
    }) as typeof fetch
    try {
      const r = await defaultSendEmail('yellow', dev, inputs)
      expect(r.sent).toBe(true)
      expect(captured.url).toBe('https://api.resend.com/emails')
      expect(captured.auth).toBe('Bearer re_test_key')
      expect(captured.body?.to).toEqual(['dev@example.com'])
    } finally {
      global.fetch = originalFetch
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
      else delete process.env.RESEND_API_KEY
    }
  })

  it('red tier cc\'s the founder email (FOUNDER_EMAIL env)', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    process.env.FOUNDER_EMAIL = 'founder@settlegrid.test'
    let captured: { body?: { to?: string[] } } = {}
    global.fetch = vi.fn(async (_url: string, init: { body?: string }) => {
      captured.body = init.body ? JSON.parse(init.body as string) : undefined
      return { ok: true, status: 200, text: async () => 'ok' } as Response
    }) as typeof fetch
    try {
      const r = await defaultSendEmail('red', dev, inputs)
      expect(r.sent).toBe(true)
      expect(captured.body?.to).toEqual([
        'dev@example.com',
        'founder@settlegrid.test',
      ])
    } finally {
      global.fetch = originalFetch
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
      else delete process.env.RESEND_API_KEY
      if (originalFounder !== undefined) process.env.FOUNDER_EMAIL = originalFounder
      else delete process.env.FOUNDER_EMAIL
    }
  })

  it('red tier falls back to the hardcoded founder address when FOUNDER_EMAIL is unset', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    delete process.env.FOUNDER_EMAIL
    let captured: { body?: { to?: string[] } } = {}
    global.fetch = vi.fn(async (_url: string, init: { body?: string }) => {
      captured.body = init.body ? JSON.parse(init.body as string) : undefined
      return { ok: true, status: 200, text: async () => 'ok' } as Response
    }) as typeof fetch
    try {
      await defaultSendEmail('red', dev, inputs)
      expect(captured.body?.to?.[0]).toBe('dev@example.com')
      expect(captured.body?.to?.[1]).toMatch(/@/) // some founder email present
      expect(captured.body?.to?.length).toBe(2)
    } finally {
      global.fetch = originalFetch
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
      else delete process.env.RESEND_API_KEY
      if (originalFounder !== undefined) process.env.FOUNDER_EMAIL = originalFounder
    }
  })

  it('returns sent=false when Resend returns non-2xx', async () => {
    process.env.RESEND_API_KEY = 're_test_key'
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn(async () => ({
      ok: false,
      status: 500,
      text: async () => 'Resend internal error',
    })) as unknown as typeof fetch
    try {
      const r = await defaultSendEmail('yellow', dev, inputs)
      expect(r.sent).toBe(false)
      expect(errSpy).toHaveBeenCalled()
    } finally {
      global.fetch = originalFetch
      if (originalKey !== undefined) process.env.RESEND_API_KEY = originalKey
      else delete process.env.RESEND_API_KEY
      errSpy.mockRestore()
    }
  })
})

// ─── Default DB factories — assert SQL shape ─────────────────────────

interface CapturedQuery {
  sql: string
  params: unknown[]
}

/**
 * Build a fake postgres-js tag function that captures the SQL strings
 * + interpolated parameters and returns a configurable result. Useful
 * for asserting SQL shape without spinning up a real Postgres.
 */
function makeFakeSql(stub?: () => unknown): {
  sql: PostgresLikeClient
  captured: CapturedQuery[]
} {
  const captured: CapturedQuery[] = []
  const sql = ((strings: TemplateStringsArray, ...values: unknown[]) => {
    captured.push({ sql: strings.join('?'), params: values })
    return Promise.resolve(stub ? stub() : [])
  }) as unknown as PostgresLikeClient
  // postgres-js exposes `end()` on the SDK callable; tests don't use it
  // but we need the property for type compat.
  ;(sql as unknown as { end: () => Promise<void> }).end = async () => {}
  return { sql, captured }
}

describe('makeDefaultLoadDevelopers', () => {
  it('queries all developers when developerId is null', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultLoadDevelopers(sql)
    await fn(null)
    expect(captured).toHaveLength(1)
    expect(captured[0].sql).toMatch(/FROM developers/)
    expect(captured[0].sql).toMatch(/stripe_connect_id IS NOT NULL/)
    // no developer-id predicate when null
    expect(captured[0].sql).not.toMatch(/id = \?::uuid/)
    // no deleted_at filter (column doesn't exist) — H3 hostile fix
    expect(captured[0].sql).not.toMatch(/deleted_at/)
  })

  it('restricts to a single developer when developerId is provided', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultLoadDevelopers(sql)
    await fn('00000000-0000-0000-0000-000000000123')
    expect(captured).toHaveLength(1)
    expect(captured[0].sql).toMatch(/id = \?::uuid/)
    expect(captured[0].params[0]).toBe('00000000-0000-0000-0000-000000000123')
  })

  it('maps DB rows to DeveloperContext shape (snake_case → camelCase)', async () => {
    const { sql } = makeFakeSql(() => [
      {
        id: 'd1',
        email: 'a@b.com',
        name: null,
        stripe_connect_id: 'acct_x',
        onboarding_paused: true,
      },
    ])
    const fn = makeDefaultLoadDevelopers(sql)
    const out = await fn(null)
    expect(out).toEqual([
      {
        id: 'd1',
        email: 'a@b.com',
        name: null,
        stripeConnectId: 'acct_x',
        alreadyPaused: true,
      },
    ])
  })

  it('coerces NULL onboarding_paused to false', async () => {
    const { sql } = makeFakeSql(() => [
      {
        id: 'd1',
        email: 'a@b.com',
        name: 'Alice',
        stripe_connect_id: 'acct_x',
        onboarding_paused: null,
      },
    ])
    const fn = makeDefaultLoadDevelopers(sql)
    const out = await fn(null)
    expect(out[0].alreadyPaused).toBe(false)
  })
})

describe('makeDefaultLoadAlertHistory', () => {
  it('reads created_at (NOT emitted_at) and filters to email_status=sent', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultLoadAlertHistory(sql)
    await fn('00000000-0000-0000-0000-000000000001', 24 * 7)
    expect(captured).toHaveLength(1)
    expect(captured[0].sql).toMatch(/SELECT tier, created_at/)
    expect(captured[0].sql).not.toMatch(/emitted_at/) // H2 schema-mismatch fix
    expect(captured[0].sql).toMatch(/email_status = 'sent'/) // H4 rate-limit fix
    expect(captured[0].sql).toMatch(/LIMIT 500/) // H4 cap
    // ORDER BY clause uses created_at DESC
    expect(captured[0].sql).toMatch(/ORDER BY created_at DESC/)
  })

  it('passes the windowHours-derived cutoff as a parameter (not interpolated)', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultLoadAlertHistory(sql)
    await fn('00000000-0000-0000-0000-000000000001', 24)
    // First param is developerId, second is the ISO cutoff
    expect(typeof captured[0].params[0]).toBe('string')
    expect(typeof captured[0].params[1]).toBe('string')
    // Cutoff is roughly NOW() minus 24h
    const cutoffMs = Date.parse(captured[0].params[1] as string)
    const expectedMs = Date.now() - 24 * 60 * 60 * 1000
    expect(Math.abs(cutoffMs - expectedMs)).toBeLessThan(5_000) // 5s tolerance
  })

  it('maps DB rows to ChargebackAlertHistoryRow with ISO timestamps', async () => {
    const ts = new Date('2026-04-25T12:00:00Z')
    const { sql } = makeFakeSql(() => [
      { tier: 'yellow', created_at: ts },
      { tier: 'red', created_at: '2026-04-26T12:00:00.000Z' },
    ])
    const fn = makeDefaultLoadAlertHistory(sql)
    const out = await fn('d1', 24 * 7)
    expect(out).toHaveLength(2)
    expect(out[0].tier).toBe('yellow')
    expect(out[0].emittedAtIso).toBe('2026-04-25T12:00:00.000Z')
    expect(out[1].tier).toBe('red')
    expect(out[1].emittedAtIso).toBe('2026-04-26T12:00:00.000Z')
  })
})

describe('makeDefaultPersistAlert', () => {
  const params = {
    developerId: '00000000-0000-0000-0000-000000000001',
    tier: 'yellow' as const,
    classification: {
      tier: 'yellow' as const,
      rateByCount: 0.004,
      rateByVolume: 0.0035,
      suppressedByLowSampleSize: false,
      reason: 'worstRate=0.0040 > 0.003',
    },
    inputs: {
      chargesCount: 100,
      chargebacksCount: 1,
      chargesVolumeCents: 100_000,
      chargebacksVolumeCents: 1_000,
    },
    emailStatus: 'sent' as const,
    pauseApplied: false,
  }

  it('inserts into chargeback_alerts with the correct columns', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultPersistAlert(sql)
    await fn(params)
    expect(captured).toHaveLength(1)
    expect(captured[0].sql).toMatch(/INSERT INTO chargeback_alerts/)
    // H1 — must NOT reference nonexistent columns
    expect(captured[0].sql).not.toMatch(/\breason\b/)
    expect(captured[0].sql).not.toMatch(/\bemitted_at\b/)
    // Required columns
    expect(captured[0].sql).toMatch(/details/)
    expect(captured[0].sql).toMatch(/email_status/)
    expect(captured[0].sql).toMatch(/created_at/)
    expect(captured[0].sql).toMatch(/::jsonb/) // details cast
  })

  it('serializes rate_by_count and rate_by_volume as text (matches schema)', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultPersistAlert(sql)
    await fn(params)
    // The classification's rates are passed as strings (.toString())
    // Find the rate values in the params — they should be string forms
    const stringParams = captured[0].params.filter((p) => typeof p === 'string')
    expect(stringParams).toContain('0.004')
    expect(stringParams).toContain('0.0035')
  })

  it('emits a JSON details payload with replay metadata', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultPersistAlert(sql)
    await fn(params)
    // details is the JSON.stringify'd object — find it in params
    const jsonStrings = captured[0].params.filter(
      (p) => typeof p === 'string' && p.startsWith('{'),
    )
    expect(jsonStrings.length).toBeGreaterThan(0)
    const parsed = JSON.parse(jsonStrings[0] as string)
    expect(parsed.reason).toBe(params.classification.reason)
    expect(parsed.suppressedByLowSampleSize).toBe(false)
    expect(parsed.inputs.chargesCount).toBe(100)
    expect(parsed.thresholdsAtRunTime.rateByCount).toBe(0.004)
  })
})

describe('makeDefaultFlipPause', () => {
  it('updates developers row with onboarding_paused=true and timestamp', async () => {
    const { sql, captured } = makeFakeSql(() => [])
    const fn = makeDefaultFlipPause(sql)
    await fn('00000000-0000-0000-0000-000000000001', 'red tier hit')
    expect(captured).toHaveLength(1)
    expect(captured[0].sql).toMatch(/UPDATE developers/)
    expect(captured[0].sql).toMatch(/onboarding_paused = true/)
    expect(captured[0].sql).toMatch(/onboarding_paused_at = NOW\(\)/)
    expect(captured[0].sql).toMatch(/onboarding_paused_reason = \?/)
    expect(captured[0].sql).toMatch(/WHERE id = \?::uuid/)
    expect(captured[0].params).toContain('red tier hit')
    expect(captured[0].params).toContain('00000000-0000-0000-0000-000000000001')
  })
})
