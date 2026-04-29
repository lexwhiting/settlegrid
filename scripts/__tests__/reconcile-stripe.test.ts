/**
 * P3.RAIL2 — Smoke tests for the orchestration script
 * (`scripts/reconcile-stripe.ts`). Pure-function coverage of the
 * `@settlegrid/rails` reconciliation primitives lives in
 * `packages/rails/src/__tests__/stripe-reconcile.test.ts`. Tests
 * here verify the orchestration wiring with both ledgers mocked:
 *
 *   - parseArgs handles dates, dry-run, force, threshold-bps,
 *     rate-limit-hours, and rejects malformed input.
 *   - yesterdayUtcIso() returns the calendar day BEFORE `nowMs`.
 *   - runReconcile in dry-run mode never invokes the DB query
 *     or Stripe client factory.
 *   - runReconcile partitions ledger rows by externalRef shape
 *     (acct_X → transfers leg, ch_X / null → charges leg).
 *   - runReconcile writes a frozen combined report and refuses
 *     to overwrite without --force.
 *   - The orchestrator opens a GitHub issue when shouldOpenIssue
 *     says open, AND records the timestamp to the state file —
 *     subsequent runs are rate-limited.
 *   - Webhook posting is best-effort (failures don't abort the run).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  buildIssueBody,
  main,
  openGitHubIssue,
  parseArgs,
  postSummaryWebhooks,
  readState,
  runReconcile,
  writeCombinedReport,
  writeState,
  yesterdayUtcIso,
  type CliArgs,
  type CombinedReport,
  type LedgerQueryFn,
  type ReconcileDeps,
} from '../reconcile-stripe'

import type {
  DriftReport,
  StripeBalanceTransaction,
  StripeReconcileClient,
  StripeTransfer,
} from '@settlegrid/rails'

// ─── Helpers ─────────────────────────────────────────────────────────

function makeArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
    dateUtc: '2026-04-23',
    dryRun: false,
    force: false,
    thresholdBps: 100,
    rateLimitHours: 24,
    help: false,
    ...overrides,
  }
}

function makeStripeClient(
  bts: StripeBalanceTransaction[],
  trs: StripeTransfer[],
): StripeReconcileClient {
  return {
    balanceTransactions: {
      list: async () => ({ data: [...bts], has_more: false }),
    },
    transfers: {
      list: async () => ({ data: [...trs], has_more: false }),
    },
  }
}

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reconcile-test-'))
})

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true })
})

// ─── parseArgs ───────────────────────────────────────────────────────

describe('parseArgs', () => {
  it('defaults to yesterday UTC, no dry-run, 100 bps, 24h', () => {
    const args = parseArgs([])
    expect(args.dateUtc).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(args.dryRun).toBe(false)
    expect(args.force).toBe(false)
    expect(args.thresholdBps).toBe(100)
    expect(args.rateLimitHours).toBe(24)
  })

  it('accepts --date YYYY-MM-DD', () => {
    expect(parseArgs(['--date', '2026-04-23']).dateUtc).toBe('2026-04-23')
  })

  it('rejects malformed --date', () => {
    expect(() => parseArgs(['--date', '4/23/2026'])).toThrow(TypeError)
    expect(() => parseArgs(['--date'])).toThrow(/--date requires/)
    expect(() => parseArgs(['--date', '--dry-run'])).toThrow(/--date requires/)
  })

  it('rejects invalid calendar dates (e.g. 2026-02-30 rolls into March)', () => {
    expect(() => parseArgs(['--date', '2026-02-30'])).toThrow(/not a valid UTC calendar date/)
  })

  it('parses --dry-run and --force flags', () => {
    expect(parseArgs(['--dry-run']).dryRun).toBe(true)
    expect(parseArgs(['--force']).force).toBe(true)
  })

  it('parses --threshold-bps and validates non-negative integer', () => {
    expect(parseArgs(['--threshold-bps', '50']).thresholdBps).toBe(50)
    expect(parseArgs(['--threshold-bps', '0']).thresholdBps).toBe(0)
    expect(() => parseArgs(['--threshold-bps', '-1'])).toThrow(/non-negative integer/)
    expect(() => parseArgs(['--threshold-bps', '1.5'])).toThrow(/non-negative integer/)
    expect(() => parseArgs(['--threshold-bps', 'foo'])).toThrow(/non-negative integer/)
  })

  it('parses --rate-limit-hours and rejects negatives / non-numbers', () => {
    expect(parseArgs(['--rate-limit-hours', '12']).rateLimitHours).toBe(12)
    expect(parseArgs(['--rate-limit-hours', '0.5']).rateLimitHours).toBe(0.5)
    expect(() => parseArgs(['--rate-limit-hours', '-1'])).toThrow(/non-negative number/)
    expect(() => parseArgs(['--rate-limit-hours', 'NaN'])).toThrow(/non-negative number/)
  })

  it('rejects unknown args', () => {
    expect(() => parseArgs(['--something-else'])).toThrow(/Unknown argument/)
  })

  it('--help / -h sets the help flag instead of process.exit (test-runner safe)', () => {
    expect(parseArgs(['--help']).help).toBe(true)
    expect(parseArgs(['-h']).help).toBe(true)
    expect(parseArgs([]).help).toBe(false)
  })
})

// ─── yesterdayUtcIso ─────────────────────────────────────────────────

describe('yesterdayUtcIso', () => {
  it('returns the UTC calendar day before nowMs', () => {
    // 2026-04-24T00:00:01 UTC → yesterday is 2026-04-23.
    const ms = Date.UTC(2026, 3, 24, 0, 0, 1)
    expect(yesterdayUtcIso(ms)).toBe('2026-04-23')
  })

  it('crosses month boundaries cleanly', () => {
    // 2026-05-01T00:00:01 UTC → 2026-04-30
    const ms = Date.UTC(2026, 4, 1, 0, 0, 1)
    expect(yesterdayUtcIso(ms)).toBe('2026-04-30')
  })

  it('crosses year boundaries cleanly', () => {
    // 2026-01-01T00:00:01 UTC → 2025-12-31
    const ms = Date.UTC(2026, 0, 1, 0, 0, 1)
    expect(yesterdayUtcIso(ms)).toBe('2025-12-31')
  })
})

// ─── readState / writeState ──────────────────────────────────────────

describe('state file', () => {
  it('readState ok=true with null lastIssueAtIso when file is missing', () => {
    const file = join(tmpDir, '.reconcile-state.json')
    const r = readState(file)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state).toEqual({ lastIssueAtIso: null })
  })

  it('readState surfaces a corrupt JSON file as ok=false (fail-closed)', () => {
    const file = join(tmpDir, '.reconcile-state.json')
    writeFileSync(file, '{ this is not json', 'utf-8')
    const r = readState(file)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('corrupt-json')
  })

  it('readState surfaces an unexpected shape as ok=false', () => {
    const file = join(tmpDir, '.reconcile-state.json')
    writeFileSync(file, JSON.stringify({ foo: 'bar' }), 'utf-8')
    const r = readState(file)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toBe('invalid-shape')
  })

  it('writeState then readState round-trips', () => {
    const file = join(tmpDir, '.reconcile-state.json')
    writeState({ lastIssueAtIso: '2026-04-24T08:00:00.000Z' }, file)
    const r = readState(file)
    expect(r.ok).toBe(true)
    if (r.ok)
      expect(r.state).toEqual({
        lastIssueAtIso: '2026-04-24T08:00:00.000Z',
      })
  })

  it('readState accepts an explicit null lastIssueAtIso (clean state)', () => {
    const file = join(tmpDir, '.reconcile-state.json')
    writeFileSync(file, JSON.stringify({ lastIssueAtIso: null }), 'utf-8')
    const r = readState(file)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.state.lastIssueAtIso).toBeNull()
  })
})

// ─── writeCombinedReport ─────────────────────────────────────────────

function makeCombined(
  overrides: Partial<CombinedReport> = {},
): CombinedReport {
  const blank: DriftReport = {
    dateUtc: '2026-04-23',
    leg: 'charges',
    ledgerRowCount: 0,
    stripeRowCount: 0,
    matchedCount: 0,
    matchedLedgerRowCount: 0,
    missingInStripe: [],
    missingInSettlegrid: [],
    amountMismatch: [],
    totalLedgerCents: 0,
    totalStripeCents: 0,
    driftCents: 0,
    driftBps: 0,
  }
  const transfersBlank: DriftReport = { ...blank, leg: 'transfers' }
  return {
    schemaVersion: 1,
    dateUtc: '2026-04-23',
    generatedAtIso: '2026-04-24T08:00:00.000Z',
    thresholdBps: 100,
    charges: blank,
    transfers: transfersBlank,
    ...overrides,
  }
}

describe('writeCombinedReport', () => {
  it('writes JSON to {reportsDir}/{date}.json', () => {
    const combined = makeCombined()
    const r = writeCombinedReport(combined, { reportsDir: tmpDir })
    expect(r.written).toBe(true)
    expect(r.path).toBe(join(tmpDir, '2026-04-23.json'))
    const parsed = JSON.parse(readFileSync(r.path, 'utf-8'))
    expect(parsed.schemaVersion).toBe(1)
    expect(parsed.dateUtc).toBe('2026-04-23')
  })

  it('refuses to overwrite without --force', () => {
    const combined = makeCombined()
    writeCombinedReport(combined, { reportsDir: tmpDir })
    const r2 = writeCombinedReport(combined, { reportsDir: tmpDir })
    expect(r2.written).toBe(false)
    expect(r2.reason).toMatch(/already exists/)
  })

  it('overwrites with --force', () => {
    const combined = makeCombined()
    writeCombinedReport(combined, { reportsDir: tmpDir })
    const r2 = writeCombinedReport(combined, {
      reportsDir: tmpDir,
      force: true,
    })
    expect(r2.written).toBe(true)
  })

  it('rejects a path-traversal-shaped dateUtc (defence in depth)', () => {
    const traversal = makeCombined({ dateUtc: '../../etc/passwd' })
    expect(() => writeCombinedReport(traversal, { reportsDir: tmpDir })).toThrow(
      /must be 'YYYY-MM-DD'/,
    )
  })

  it("rejects a missing-day shape (e.g. '2026-04')", () => {
    const broken = makeCombined({ dateUtc: '2026-04' })
    expect(() => writeCombinedReport(broken, { reportsDir: tmpDir })).toThrow(
      /must be 'YYYY-MM-DD'/,
    )
  })
})

// ─── postSummaryWebhooks ─────────────────────────────────────────────

describe('postSummaryWebhooks', () => {
  it('skips webhooks when env vars are unset', async () => {
    const fetchMock = vi.fn()
    const r = await postSummaryWebhooks(
      'hi',
      {} as NodeJS.ProcessEnv,
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toEqual({ slack: 'skipped', discord: 'skipped' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('skips non-https webhook URLs (mitigates SSRF)', async () => {
    const fetchMock = vi.fn()
    const r = await postSummaryWebhooks(
      'hi',
      {
        SLACK_RECONCILE_WEBHOOK: 'http://internal.local/hook',
        DISCORD_RECONCILE_WEBHOOK: 'file:///etc/passwd',
      } as NodeJS.ProcessEnv,
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toEqual({ slack: 'skipped', discord: 'skipped' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('marks slack/discord as sent on 2xx, failed on non-ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({ ok: false })
    const r = await postSummaryWebhooks(
      'hi',
      {
        SLACK_RECONCILE_WEBHOOK: 'https://hooks.slack.com/abc',
        DISCORD_RECONCILE_WEBHOOK: 'https://discord.com/api/webhooks/x',
      } as NodeJS.ProcessEnv,
      fetchMock as unknown as typeof fetch,
    )
    expect(r).toEqual({ slack: 'sent', discord: 'failed' })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('treats fetch throw as failed (not abort)', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error('network down'))
    const r = await postSummaryWebhooks(
      'hi',
      {
        SLACK_RECONCILE_WEBHOOK: 'https://hooks.slack.com/abc',
      } as NodeJS.ProcessEnv,
      fetchMock as unknown as typeof fetch,
    )
    expect(r.slack).toBe('failed')
  })

  it('passes an AbortController signal so a hung endpoint does not stall the workflow', async () => {
    let receivedSignal: AbortSignal | undefined
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init: RequestInit) => {
        receivedSignal = init.signal as AbortSignal
        return Promise.resolve({ ok: true })
      },
    )
    const r = await postSummaryWebhooks(
      'hi',
      {
        SLACK_RECONCILE_WEBHOOK: 'https://hooks.slack.com/abc',
      } as NodeJS.ProcessEnv,
      fetchMock as unknown as typeof fetch,
    )
    expect(r.slack).toBe('sent')
    expect(receivedSignal).toBeDefined()
    expect(receivedSignal instanceof AbortSignal).toBe(true)
  })
})

// ─── openGitHubIssue ─────────────────────────────────────────────────

describe('openGitHubIssue', () => {
  it('invokes `gh issue create` with title/body/labels', () => {
    const calls: { cmd: string; args: readonly string[] }[] = []
    const invoke = (cmd: string, args: readonly string[]) => {
      calls.push({ cmd, args: [...args] })
      return { status: 0, stdout: 'https://github.com/x/y/issues/42', stderr: '' }
    }
    const r = openGitHubIssue({
      title: 't',
      body: 'b',
      labels: ['reconciliation', 'P0'],
      invoke,
      repo: 'x/y',
    })
    expect(r.ok).toBe(true)
    expect(r.detail).toBe('https://github.com/x/y/issues/42')
    expect(calls[0].cmd).toBe('gh')
    expect(calls[0].args).toEqual([
      'issue',
      'create',
      '--repo',
      'x/y',
      '--title',
      't',
      '--body',
      'b',
      '--label',
      'reconciliation,P0',
    ])
  })

  it('returns ok=false on gh failure', () => {
    const r = openGitHubIssue({
      title: 't',
      body: 'b',
      invoke: () => ({ status: 1, stdout: '', stderr: 'gh auth failed' }),
    })
    expect(r.ok).toBe(false)
    expect(r.detail).toMatch(/gh auth failed/)
  })
})

// ─── runReconcile ────────────────────────────────────────────────────

describe('runReconcile — dry-run', () => {
  it('does not invoke ledgerQuery or stripeClient', async () => {
    const ledgerQuery = vi.fn()
    const stripeClient = vi.fn()
    const log: string[] = []
    const result = await runReconcile(makeArgs({ dryRun: true }), {
      ledgerQuery: ledgerQuery as unknown as LedgerQueryFn,
      stripeClient,
      log: (m) => log.push(m),
    })
    expect(ledgerQuery).not.toHaveBeenCalled()
    expect(stripeClient).not.toHaveBeenCalled()
    expect(result.reportWritten).toBe(false)
    expect(log.join('\n')).toMatch(/dry-run/)
  })

  it('does not open a GitHub issue in dry-run even with drift', async () => {
    const invokeGh = vi.fn()
    await runReconcile(makeArgs({ dryRun: true }), {
      invokeGh: invokeGh as unknown as ReconcileDeps['invokeGh'],
    })
    expect(invokeGh).not.toHaveBeenCalled()
  })
})

describe('runReconcile — partitioning + report write', () => {
  it('partitions tr_* ledger rows into the transfers leg too (not just acct_*)', async () => {
    const ledgerQuery: LedgerQueryFn = async () => [
      {
        id: 'lg_1',
        externalRef: 'tr_xyz',
        amountCents: 5_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T13:00:00.000Z',
      },
      {
        id: 'lg_2',
        externalRef: 'ch_abc',
        amountCents: 1_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T14:00:00.000Z',
      },
    ]
    const stripeClient = () =>
      makeStripeClient(
        [
          {
            id: 'txn_abc',
            amount: 1_000,
            currency: 'usd',
            type: 'charge',
            source: 'ch_abc',
            created: 1_700_000_000,
            net: 1_000,
          },
        ],
        [
          {
            id: 'tr_xyz',
            amount: 5_000,
            currency: 'usd',
            destination: 'acct_q',
            created: 1_700_000_000,
          },
        ],
      )
    const result = await runReconcile(makeArgs(), {
      ledgerQuery,
      stripeClient,
      reportsDir: tmpDir,
      stateFile: join(tmpDir, 'state.json'),
      nowIso: '2026-04-24T08:00:00.000Z',
      log: () => {},
    })
    // tr_xyz lands in the transfers leg and resolves to acct_q.
    expect(result.reports.transfers.matchedCount).toBe(1)
    expect(result.reports.transfers.missingInStripe).toEqual([])
    // ch_abc lands in the charges leg.
    expect(result.reports.charges.matchedCount).toBe(1)
  })

  it('partitions ledger rows by externalRef shape (acct_* → transfers, else → charges)', async () => {
    const ledgerQuery: LedgerQueryFn = async () => [
      {
        id: 'lg_1',
        externalRef: 'ch_111',
        amountCents: 1_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T12:00:00.000Z',
      },
      {
        id: 'lg_2',
        externalRef: 'acct_222',
        amountCents: 5_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T13:00:00.000Z',
      },
      {
        id: 'lg_3',
        externalRef: null,
        amountCents: 200,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T14:00:00.000Z',
      },
    ]
    const stripeClient = () =>
      makeStripeClient(
        [
          {
            id: 'txn_111',
            amount: 1_000,
            currency: 'usd',
            type: 'charge',
            source: 'ch_111',
            created: 1_700_000_000,
            net: 1_000,
          },
        ],
        [
          {
            id: 'tr_222',
            amount: 5_000,
            currency: 'usd',
            destination: 'acct_222',
            created: 1_700_000_000,
          },
        ],
      )
    const result = await runReconcile(makeArgs(), {
      ledgerQuery,
      stripeClient,
      reportsDir: tmpDir,
      stateFile: join(tmpDir, 'state.json'),
      nowIso: '2026-04-24T08:00:00.000Z',
      log: () => {},
    })
    // charges leg sees lg_1 (matched) + lg_3 (missing-in-stripe).
    expect(result.reports.charges.matchedCount).toBe(1)
    expect(result.reports.charges.missingInStripe.length).toBe(1)
    expect(result.reports.charges.missingInStripe[0].ledgerId).toBe('lg_3')
    // transfers leg sees lg_2 (matched).
    expect(result.reports.transfers.matchedCount).toBe(1)
    expect(result.reports.transfers.missingInStripe).toEqual([])
    expect(result.reportWritten).toBe(true)
    expect(existsSync(result.reportPath)).toBe(true)
    const onDisk = JSON.parse(readFileSync(result.reportPath, 'utf-8'))
    expect(onDisk.schemaVersion).toBe(1)
  })

  it('opens a GitHub issue when drift exceeds threshold (and respects rate-limit on next run)', async () => {
    // Ledger has 1000¢, Stripe has 800¢ → drift = 200¢ on $10 → 2000 bps.
    const ledgerQuery: LedgerQueryFn = async () => [
      {
        id: 'lg_1',
        externalRef: 'ch_111',
        amountCents: 1_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T12:00:00.000Z',
      },
    ]
    const stripeClient = () =>
      makeStripeClient(
        [
          {
            id: 'txn_111',
            amount: 800,
            currency: 'usd',
            type: 'charge',
            source: 'ch_111',
            created: 1_700_000_000,
            net: 800,
          },
        ],
        [],
      )
    const ghCalls: number[] = []
    const invokeGh = () => {
      ghCalls.push(1)
      return { status: 0, stdout: 'https://github.com/x/y/issues/1', stderr: '' }
    }
    const stateFile = join(tmpDir, 'state.json')

    // First run — no prior state → opens issue.
    const r1 = await runReconcile(makeArgs(), {
      ledgerQuery,
      stripeClient,
      reportsDir: tmpDir,
      stateFile,
      invokeGh,
      nowIso: '2026-04-24T08:00:00.000Z',
      log: () => {},
    })
    expect(r1.issue.decision.open).toBe(true)
    expect(r1.issue.opened).toBe(true)
    expect(ghCalls.length).toBe(1)
    // State file now records the timestamp.
    const sr = readState(stateFile)
    expect(sr.ok).toBe(true)
    if (sr.ok) {
      expect(sr.state.lastIssueAtIso).toBe('2026-04-24T08:00:00.000Z')
    }

    // Second run, six hours later — rate-limited, no second issue.
    const r2 = await runReconcile(
      makeArgs({ force: true }), // overwrite report
      {
        ledgerQuery,
        stripeClient,
        reportsDir: tmpDir,
        stateFile,
        invokeGh,
        nowIso: '2026-04-24T14:00:00.000Z',
        log: () => {},
      },
    )
    expect(r2.issue.decision.open).toBe(false)
    expect(r2.issue.decision.reason).toMatch(/rate-limited/)
    expect(ghCalls.length).toBe(1) // still one — gh not called again
  })

  it('fails CLOSED when the state file is corrupt — does not open an issue', async () => {
    const stateFile = join(tmpDir, 'state.json')
    writeFileSync(stateFile, '{ corrupt JSON', 'utf-8')
    const ledgerQuery: LedgerQueryFn = async () => [
      {
        id: 'lg_1',
        externalRef: 'ch_111',
        amountCents: 1_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T12:00:00.000Z',
      },
    ]
    // Drift: Stripe records 0¢ but ledger says 1000¢.
    const stripeClient = () => makeStripeClient([], [])
    const invokeGh = vi.fn()
    const log: string[] = []
    const r = await runReconcile(makeArgs(), {
      ledgerQuery,
      stripeClient,
      reportsDir: tmpDir,
      stateFile,
      invokeGh: invokeGh as unknown as ReconcileDeps['invokeGh'],
      nowIso: '2026-04-24T08:00:00.000Z',
      log: (m) => log.push(m),
    })
    // Without the fail-closed gate, a corrupt state file would let
    // the orchestrator open a fresh issue every day until the file is
    // repaired — exactly the spam scenario hostile (c) forbids.
    expect(r.issue.decision.open).toBe(false)
    expect(r.issue.opened).toBe(false)
    expect(invokeGh).not.toHaveBeenCalled()
    expect(log.some((line) => /state file corrupt-json/.test(line))).toBe(true)
    expect(r.issue.decision.reason).toMatch(/fail-closed/)
  })

  it('does NOT open an issue on a clean reconciliation', async () => {
    const ledgerQuery: LedgerQueryFn = async () => [
      {
        id: 'lg_1',
        externalRef: 'ch_111',
        amountCents: 1_000,
        rail: 'stripe-connect',
        settledAt: '2026-04-23T12:00:00.000Z',
      },
    ]
    const stripeClient = () =>
      makeStripeClient(
        [
          {
            id: 'txn_111',
            amount: 1_000,
            currency: 'usd',
            type: 'charge',
            source: 'ch_111',
            created: 1_700_000_000,
            net: 1_000,
          },
        ],
        [],
      )
    const invokeGh = vi.fn()
    const r = await runReconcile(makeArgs(), {
      ledgerQuery,
      stripeClient,
      reportsDir: tmpDir,
      stateFile: join(tmpDir, 'state.json'),
      invokeGh: invokeGh as unknown as ReconcileDeps['invokeGh'],
      nowIso: '2026-04-24T08:00:00.000Z',
      log: () => {},
    })
    expect(r.issue.decision.open).toBe(false)
    expect(r.issue.opened).toBe(false)
    expect(invokeGh).not.toHaveBeenCalled()
  })
})

// ─── buildIssueBody ──────────────────────────────────────────────────

// ─── main + default helpers ──────────────────────────────────────────

describe('main', () => {
  let logSpy: ReturnType<typeof vi.spyOn>
  let errSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    logSpy.mockRestore()
    errSpy.mockRestore()
  })

  it('--help prints usage and returns 0 (no process.exit)', async () => {
    const code = await main(['--help'])
    expect(code).toBe(0)
    const printed = logSpy.mock.calls.map((c) => String(c[0])).join('\n')
    expect(printed).toMatch(/Usage: npx tsx scripts\/reconcile-stripe\.ts/)
    expect(printed).toMatch(/--threshold-bps/)
  })

  it('returns 2 on argument-parse error and prints help', async () => {
    const code = await main(['--something-else'])
    expect(code).toBe(2)
    expect(errSpy).toHaveBeenCalledWith(expect.stringMatching(/Argument error/))
  })

  it('--dry-run completes with exit 0 (no DB / Stripe / disk side effects)', async () => {
    const code = await main(['--dry-run', '--date', '2026-04-23'])
    expect(code).toBe(0)
  })

  it('returns 1 when runReconcile throws (e.g. DB not configured for non-dry-run)', async () => {
    // Force the default DB path by NOT injecting deps. Clear DATABASE_URL
    // so defaultLedgerQuery's early-throw fires.
    const prevDb = process.env.DATABASE_URL
    delete process.env.DATABASE_URL
    try {
      const code = await main(['--date', '2026-04-23'])
      expect(code).toBe(1)
      expect(errSpy).toHaveBeenCalledWith(
        expect.stringMatching(/DATABASE_URL is required/),
      )
    } finally {
      if (prevDb !== undefined) process.env.DATABASE_URL = prevDb
    }
  })

  it('default Stripe client throws when no key env vars are set', async () => {
    // Inject a ledgerQuery that returns rows but leave the Stripe
    // client default. With no STRIPE_* env, defaultStripeClient throws,
    // which runReconcile surfaces as exit code 1.
    const prevReconcile = process.env.STRIPE_RECONCILE_KEY
    const prevSecret = process.env.STRIPE_SECRET_KEY
    const prevDb = process.env.DATABASE_URL
    delete process.env.STRIPE_RECONCILE_KEY
    delete process.env.STRIPE_SECRET_KEY
    process.env.DATABASE_URL = 'postgres://test/test' // must be set so defaultLedgerQuery doesn't short-circuit

    // Mock runReconcile via the orchestrator path. Instead of full
    // main(), we call runReconcile() directly with only ledgerQuery
    // injected — defaultStripeClient must fire and throw.
    try {
      await expect(
        runReconcile(
          {
            dateUtc: '2026-04-23',
            dryRun: false,
            force: false,
            thresholdBps: 100,
            rateLimitHours: 24,
            help: false,
          },
          {
            // Provide a ledger query so defaultLedgerQuery never opens
            // a real Postgres connection.
            ledgerQuery: async () => [],
            log: () => {},
          },
        ),
      ).rejects.toThrow(/STRIPE_RECONCILE_KEY \(or STRIPE_SECRET_KEY\) is required/)
    } finally {
      if (prevReconcile !== undefined) process.env.STRIPE_RECONCILE_KEY = prevReconcile
      if (prevSecret !== undefined) process.env.STRIPE_SECRET_KEY = prevSecret
      if (prevDb !== undefined) process.env.DATABASE_URL = prevDb
      else delete process.env.DATABASE_URL
    }
  })
})

describe('buildIssueBody', () => {
  it('produces a markdown body with both legs and a runbook pointer', () => {
    const combined = makeCombined({
      charges: {
        ...makeCombined().charges,
        ledgerRowCount: 5,
        matchedCount: 3,
        missingInStripe: [{ ledgerId: 'lg_x', externalRef: 'ch_x', amountCents: 100 }],
        driftCents: 100,
        driftBps: 200,
      },
    })
    const body = buildIssueBody(combined, 'charges: drift_bps=200 > threshold=100')
    expect(body).toContain('## Charges leg')
    expect(body).toContain('## Transfers leg')
    expect(body).toContain('Drift: 100¢ (200 bps)')
    expect(body).toContain('docs/reconciliation/reconcile-runbook.md')
    expect(body).toContain('drift_bps=200 > threshold=100')
  })
})
