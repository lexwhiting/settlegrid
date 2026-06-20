import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture console output
const consoleSpy = {
  log: vi.spyOn(console, 'log').mockImplementation(() => {}),
  warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
  error: vi.spyOn(console, 'error').mockImplementation(() => {}),
}

const { mockCaptureMessage, mockCaptureException } = vi.hoisted(() => ({
  mockCaptureMessage: vi.fn(),
  mockCaptureException: vi.fn(),
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: mockCaptureMessage,
  captureException: mockCaptureException,
}))

import { logger } from '@/lib/logger'

describe('Structured logger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('logger.info emits JSON to console.log', () => {
    logger.info('test.event', { key: 'value' })

    expect(consoleSpy.log).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    expect(line.level).toBe('info')
    expect(line.msg).toBe('test.event')
    expect(line.key).toBe('value')
    expect(line.ts).toBeDefined()
  })

  it('logger.warn emits JSON to console.warn', () => {
    logger.warn('warning.event', { code: 42 })

    expect(consoleSpy.warn).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.warn.mock.calls[0][0] as string)
    expect(line.level).toBe('warn')
    expect(line.msg).toBe('warning.event')
    expect(line.code).toBe(42)
  })

  it('logger.error emits JSON to console.error with error details', () => {
    const err = new Error('something broke')
    logger.error('error.event', { context: 'test' }, err)

    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.level).toBe('error')
    expect(line.msg).toBe('error.event')
    expect(line.context).toBe('test')
    expect(line.error).toBe('something broke')
    expect(line.stack).toContain('Error: something broke')
  })

  it('logger.error handles non-Error objects as error argument', () => {
    logger.error('error.event', {}, 'string-error')

    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.error).toBe('string-error')
    expect(line.stack).toBeUndefined()
  })

  it('logger.info works without metadata', () => {
    logger.info('simple.event')

    expect(consoleSpy.log).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    expect(line.level).toBe('info')
    expect(line.msg).toBe('simple.event')
  })

  it('emitted JSON includes ISO timestamp', () => {
    logger.info('ts.test')

    const line = JSON.parse(consoleSpy.log.mock.calls[0][0] as string)
    // Verify it's a valid ISO date string
    const parsed = new Date(line.ts)
    expect(parsed.getTime()).not.toBeNaN()
  })

  it('reserved keys (msg/level/ts) win over a clobbering meta key (S-D14)', () => {
    // 28 cron/crawler sites pass a human `{ msg: '…' }` meta. The positional
    // structured event key (what Sentry logKey + log queries key on) must win;
    // the meta must never overwrite `msg`/`level`/`ts`.
    logger.error('cron.aggregate_usage.no_secret', {
      msg: 'CRON_SECRET not configured',
      level: 'info',
      ts: 'not-a-timestamp',
      detail: 'kept',
    })

    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.msg).toBe('cron.aggregate_usage.no_secret') // structured key wins
    expect(line.level).toBe('error') // reserved level wins over meta.level
    expect(line.detail).toBe('kept') // non-reserved meta still passes through
    expect(line.ts).not.toBe('not-a-timestamp') // reserved ts wins
    expect(Number.isNaN(new Date(line.ts).getTime())).toBe(false)
  })

  it('a real Error still wins over meta.error/meta.stack (precedence preserved under spread-first)', () => {
    const err = new Error('real failure')
    logger.error('settlement.failed', { error: 'meta-error-should-lose', stack: 'meta-stack' }, err)

    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.error).toBe('real failure')
    expect(line.stack).toContain('Error: real failure')
  })
})

describe('Sentry mirror — error-level logs only, gated on SENTRY_DSN', () => {
  const origDsn = process.env.SENTRY_DSN

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (origDsn === undefined) {
      delete process.env.SENTRY_DSN
    } else {
      process.env.SENTRY_DSN = origDsn
    }
  })

  it('does NOT call Sentry when SENTRY_DSN is unset (local/test path)', () => {
    delete process.env.SENTRY_DSN
    logger.error('payout.rollback_failed', { developerId: 'dev-1' })
    expect(mockCaptureMessage).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('routes Error-bearing calls through captureException as a sanitized CLONE (not the caller err) with logKey tag', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    const err = new Error('boom')
    logger.error('payout.rollback_failed', { developerId: 'dev-1' }, err)
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    // B5: assert a DISTINCT clone by IDENTITY, not deep-equality. The prior
    // `toHaveBeenCalledWith(err, …)` passed even against the original `err`
    // (vitest deep-equals a structurally-identical clone of `new Error('boom')`)
    // AND would STILL pass if F2's unconditional clone were reverted (clean
    // message → no clone → original err → also deep-equal). This pins the
    // unconditional-clone behavior for real, so it actually protects F2.
    const [capturedErr, opts] = mockCaptureException.mock.calls[0] as [
      Error,
      { tags: Record<string, unknown>; extra: Record<string, unknown> },
    ]
    expect(capturedErr).not.toBe(err) // a distinct sanitized clone, never the caller's object
    expect(capturedErr).toBeInstanceOf(Error)
    expect(capturedErr.name).toBe('Error') // exception type / grouping key preserved
    expect(capturedErr.message).toBe('boom') // redacted message (clean here) preserved
    expect(opts.tags).toEqual({ logKey: 'payout.rollback_failed' })
    expect(opts.extra).toEqual({ developerId: 'dev-1' })
    expect(mockCaptureMessage).not.toHaveBeenCalled()
  })

  it('routes message-only calls through captureMessage with level=error', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    logger.error('payout.unknown_rows_pending', { count: 3 })
    expect(mockCaptureMessage).toHaveBeenCalledTimes(1)
    expect(mockCaptureMessage).toHaveBeenCalledWith(
      'payout.unknown_rows_pending',
      {
        level: 'error',
        tags: { logKey: 'payout.unknown_rows_pending' },
        extra: { count: 3 },
      },
    )
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('does NOT call Sentry for info / warn levels even with DSN set', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    logger.info('user.signed_in', { userId: 'u-1' })
    logger.warn('rate_limit.near', { ip: '1.2.3.4' })
    expect(mockCaptureMessage).not.toHaveBeenCalled()
    expect(mockCaptureException).not.toHaveBeenCalled()
  })

  it('swallows Sentry transport failures so the JSON line still ships', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    mockCaptureMessage.mockImplementationOnce(() => {
      throw new Error('Sentry transport failed')
    })
    // The logger must not throw — operator still sees the JSON line on
    // stderr; losing the Sentry mirror is non-fatal.
    expect(() => logger.error('test.key', { foo: 'bar' })).not.toThrow()
  })
})

describe('V-N3 channel B — emit() payer/nonce sanitizer (err.message/stack + free-text meta)', () => {
  const origDsn = process.env.SENTRY_DSN
  const PAYER = '0x' + 'ab'.repeat(20) // 40 hex EVM address
  const NONCE = '0x' + 'cd'.repeat(32) // 64 hex EIP-3009 nonce

  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    if (origDsn === undefined) delete process.env.SENTRY_DSN
    else process.env.SENTRY_DSN = origDsn
  })

  it('redacts a viem error (raw from+nonce in its message) on the stdout line', () => {
    const viem = new Error(
      `ContractFunctionExecutionError: transferWithAuthorization(from ${PAYER}, nonce ${NONCE}) reverted`,
    )
    logger.error('x402.settle_submit_error', { network: 'eip155:8453' }, viem)
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.error).not.toContain(PAYER)
    expect(line.error).not.toContain(NONCE)
    expect(line.error).toContain('0x<redacted>')
    expect(line.network).toBe('eip155:8453') // structured field untouched
  })

  it('redacts a PG error echoing the raw operation_id in err.message', () => {
    const pg = new Error(
      `duplicate key value ... operation_id=(x402:eip155:8453:${PAYER}:${NONCE}) already exists`,
    )
    logger.error('reconcile.row_error', { rail: 'x402' }, pg)
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.error).toContain('x402:eip155:8453:anon')
    expect(line.error).not.toContain(PAYER)
    expect(line.error).not.toContain(NONCE)
    expect(line.stack ?? '').not.toContain(PAYER)
  })

  it('captureException receives a CLONE with redacted message (not the raw err) + sanitized extra', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    const viem = new Error(`reverted: from ${PAYER} nonce ${NONCE}`)
    logger.error('settlement.credit_failed', { error: `WHERE operationId=${PAYER}` }, viem)
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    const [capturedErr, opts] = mockCaptureException.mock.calls[0] as [Error, { extra: Record<string, unknown> }]
    expect(capturedErr).not.toBe(viem) // a sanitized clone, never the caller's object
    expect(capturedErr.message).not.toContain(PAYER)
    expect(capturedErr.message).toContain('0x<redacted>')
    expect(capturedErr.name).toBe('Error') // exception type / grouping preserved
    expect(String(opts.extra.error)).not.toContain(PAYER) // free-text meta key sanitized for Sentry
  })

  it('redacts free-text meta keys but leaves structured txHash/recipient intact', () => {
    logger.error('proxy.onchain_credit_lost_after_settle', {
      txHash: PAYER, // structured field (a tx-hash-shaped value) — NEVER redacted
      reason: `payer ${PAYER} unreachable`, // free-text key — redacted
    })
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(line.txHash).toBe(PAYER) // structured field passes through verbatim
    expect(line.reason).not.toContain(PAYER)
    expect(line.reason).toContain('0x<redacted>')
  })

  it('captures a sanitized CLONE even when the top message is clean — drops the PII-bearing cause (F2/M3)', () => {
    // The OLD conditional gate shipped the ORIGINAL err whenever message+stack
    // looked clean, so a raw from/nonce hiding in `.cause` reached Sentry and the
    // default `linkedErrors` integration serialized it. The clone is now
    // UNCONDITIONAL and copies only name + redacted message + redacted stack.
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    const clean = new Error('connection refused ECONNREFUSED')
    ;(clean as Error & { cause?: unknown }).cause = new Error(`inner: from ${PAYER} nonce ${NONCE}`)
    logger.error('reconcile.uncredited_check_failed', {}, clean)
    const [capturedErr] = mockCaptureException.mock.calls[0] as [Error & { cause?: unknown }]
    expect(capturedErr).not.toBe(clean) // distinct identity — a sanitized copy
    expect(capturedErr.message).toBe('connection refused ECONNREFUSED') // clean message preserved verbatim
    expect(capturedErr.name).toBe('Error') // exception type / grouping key preserved
    expect(capturedErr.cause).toBeUndefined() // the raw-PII cause chain NEVER reaches Sentry
  })

  it('captures a sanitized clone of an AggregateError WITHOUT its .errors[] legs (F2/M3)', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    const agg = new AggregateError(
      [new Error(`leg-1 from ${PAYER}`), new Error(`leg-2 nonce ${NONCE}`)],
      'all settlement legs failed',
    )
    logger.error('settlement.multi_leg_failed', { rail: 'x402' }, agg)
    const [capturedErr] = mockCaptureException.mock.calls[0] as [Error & { errors?: unknown[] }]
    expect(capturedErr).not.toBe(agg)
    expect(capturedErr.name).toBe('AggregateError') // name preserved for Sentry grouping
    expect(capturedErr.errors).toBeUndefined() // the raw-PII legs are DROPPED, never serialized
    expect(capturedErr.message).toBe('all settlement legs failed') // clean top message kept
  })

  it('does NOT throw when err.message is a non-string, and still redacts the coerced text (M5)', () => {
    // logger.error runs inside catch blocks; a `TypeError: s.replace is not a
    // function` out of emit() would alter control flow AND drop the log line.
    const weird = new Error('placeholder')
    ;(weird as unknown as { message: unknown }).message = { toString: () => `boom from ${PAYER}` }
    expect(() =>
      logger.error('x402.settle_submit_error', { network: 'eip155:8453' }, weird),
    ).not.toThrow()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(typeof line.error).toBe('string')
    expect(line.error).not.toContain(PAYER)
    expect(line.error).toContain('0x<redacted>')
  })

  it('does NOT throw out of emit() on an oversized contiguous hex run in err.message (B2)', () => {
    // The greedy LONG_HEX_RUN ({40,}) overflows String.replace's call stack on a
    // single ≈5.3 MB+ contiguous match (RangeError). redactLogString is invoked
    // OUTSIDE emit()'s only try, so an un-guarded throw escapes emit(), drops the
    // log line, and alters the surrounding catch's control flow. The input cap
    // closes it: a ~6 MB hex run must not throw and the line still ships redacted.
    const huge = new Error('viem revert: data=0x' + 'a'.repeat(6 * 1024 * 1024))
    expect(() =>
      logger.error('x402.settle_submit_error', { network: 'eip155:8453' }, huge),
    ).not.toThrow()
    expect(consoleSpy.error).toHaveBeenCalledOnce()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(typeof line.error).toBe('string')
    expect(line.error).toContain('0x<redacted>') // the run is redacted, not left raw
    expect(line.error).not.toContain('a'.repeat(41)) // no bare-hex tail residue survives
  })

  it('does NOT throw when a non-string err.message COERCES to an oversized hex run (M5 × B2, CM-2)', () => {
    // The M5 fix itself can MANUFACTURE the B2 throw: String(err.message) of a
    // ≥5.3 MB hex run feeds redactLogString an oversized string. One shared cap
    // covers both axes.
    const weird = new Error('placeholder')
    ;(weird as unknown as { message: unknown }).message = {
      toString: () => '0x' + 'a'.repeat(6 * 1024 * 1024),
    }
    expect(() =>
      logger.error('x402.settle_submit_error', { network: 'eip155:8453' }, weird),
    ).not.toThrow()
    const line = JSON.parse(consoleSpy.error.mock.calls[0][0] as string)
    expect(typeof line.error).toBe('string')
    expect(line.error).not.toContain('a'.repeat(41))
  })
})
