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

  it('routes Error-bearing calls through captureException with logKey tag', () => {
    process.env.SENTRY_DSN = 'https://test@sentry.test/1'
    const err = new Error('boom')
    logger.error('payout.rollback_failed', { developerId: 'dev-1' }, err)
    expect(mockCaptureException).toHaveBeenCalledTimes(1)
    expect(mockCaptureException).toHaveBeenCalledWith(err, {
      tags: { logKey: 'payout.rollback_failed' },
      extra: { developerId: 'dev-1' },
    })
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
