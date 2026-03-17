import { describe, it, expect } from 'vitest'
import {
  SettleGridError,
  InvalidKeyError,
  InsufficientCreditsError,
  ToolNotFoundError,
  ToolDisabledError,
  RateLimitedError,
  SettleGridUnavailableError,
  NetworkError,
  TimeoutError,
} from '../errors'

describe('SettleGridError', () => {
  it('has correct properties', () => {
    const error = new SettleGridError('test error', 'SERVER_ERROR', 500)
    expect(error.message).toBe('test error')
    expect(error.code).toBe('SERVER_ERROR')
    expect(error.statusCode).toBe(500)
    expect(error.name).toBe('SettleGridError')
  })

  it('serializes to JSON', () => {
    const error = new SettleGridError('test', 'SERVER_ERROR', 500)
    const json = error.toJSON()
    expect(json).toEqual({ error: 'test', code: 'SERVER_ERROR', statusCode: 500 })
  })

  it('is an instance of Error', () => {
    const error = new SettleGridError('test', 'SERVER_ERROR', 500)
    expect(error).toBeInstanceOf(Error)
  })
})

describe('InvalidKeyError', () => {
  it('uses default message', () => {
    const error = new InvalidKeyError()
    expect(error.message).toContain('Invalid or revoked API key')
    expect(error.message).toContain('settlegrid.ai/keys')
    expect(error.code).toBe('INVALID_KEY')
    expect(error.statusCode).toBe(401)
    expect(error.name).toBe('InvalidKeyError')
  })

  it('accepts custom message', () => {
    const error = new InvalidKeyError('Key expired')
    expect(error.message).toBe('Key expired')
  })
})

describe('InsufficientCreditsError', () => {
  it('includes credit amounts', () => {
    const error = new InsufficientCreditsError(5, 2)
    expect(error.requiredCents).toBe(5)
    expect(error.availableCents).toBe(2)
    expect(error.code).toBe('INSUFFICIENT_CREDITS')
    expect(error.statusCode).toBe(402)
    expect(error.message).toContain('5')
    expect(error.message).toContain('2')
  })
})

describe('ToolNotFoundError', () => {
  it('includes slug in message', () => {
    const error = new ToolNotFoundError('my-tool')
    expect(error.message).toContain('my-tool')
    expect(error.code).toBe('TOOL_NOT_FOUND')
    expect(error.statusCode).toBe(404)
  })
})

describe('ToolDisabledError', () => {
  it('includes slug in message', () => {
    const error = new ToolDisabledError('disabled-tool')
    expect(error.message).toContain('disabled-tool')
    expect(error.code).toBe('TOOL_DISABLED')
    expect(error.statusCode).toBe(403)
  })
})

describe('RateLimitedError', () => {
  it('includes retry after', () => {
    const error = new RateLimitedError(5000)
    expect(error.retryAfterMs).toBe(5000)
    expect(error.code).toBe('RATE_LIMITED')
    expect(error.statusCode).toBe(429)
  })
})

describe('SettleGridUnavailableError', () => {
  it('uses default message', () => {
    const error = new SettleGridUnavailableError()
    expect(error.message).toContain('SettleGrid API is temporarily unavailable')
    expect(error.message).toContain('status.settlegrid.ai')
    expect(error.statusCode).toBe(503)
  })
})

describe('NetworkError', () => {
  it('uses default message', () => {
    const error = new NetworkError()
    expect(error.statusCode).toBe(503)
    expect(error.code).toBe('NETWORK_ERROR')
  })
})

describe('TimeoutError', () => {
  it('includes timeout value', () => {
    const error = new TimeoutError(3000)
    expect(error.message).toContain('3000')
    expect(error.statusCode).toBe(504)
    expect(error.code).toBe('TIMEOUT')
  })
})
