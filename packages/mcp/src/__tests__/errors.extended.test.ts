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

describe('SettleGridError (extended)', () => {
  it('is instanceof Error', () => {
    const err = new SettleGridError('test', 'SERVER_ERROR', 500)
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(SettleGridError)
  })

  it('has correct name property', () => {
    const err = new SettleGridError('msg', 'SERVER_ERROR', 500)
    expect(err.name).toBe('SettleGridError')
  })

  it('toJSON includes all fields', () => {
    const err = new SettleGridError('fail', 'NETWORK_ERROR', 503)
    const json = err.toJSON()
    expect(json.error).toBe('fail')
    expect(json.code).toBe('NETWORK_ERROR')
    expect(json.statusCode).toBe(503)
  })

  it('has a stack trace', () => {
    const err = new SettleGridError('stack', 'SERVER_ERROR', 500)
    expect(err.stack).toBeDefined()
    expect(typeof err.stack).toBe('string')
  })
})

describe('InvalidKeyError (extended)', () => {
  it('extends SettleGridError', () => {
    const err = new InvalidKeyError()
    expect(err).toBeInstanceOf(SettleGridError)
    expect(err).toBeInstanceOf(Error)
  })

  it('has INVALID_KEY code', () => {
    expect(new InvalidKeyError().code).toBe('INVALID_KEY')
  })

  it('has 401 status', () => {
    expect(new InvalidKeyError().statusCode).toBe(401)
  })

  it('serializes to JSON correctly', () => {
    const json = new InvalidKeyError('Custom message').toJSON()
    expect(json.error).toBe('Custom message')
    expect(json.code).toBe('INVALID_KEY')
    expect(json.statusCode).toBe(401)
  })
})

describe('InsufficientCreditsError (extended)', () => {
  it('extends SettleGridError', () => {
    const err = new InsufficientCreditsError(10, 5)
    expect(err).toBeInstanceOf(SettleGridError)
  })

  it('message mentions both amounts', () => {
    const err = new InsufficientCreditsError(100, 50)
    expect(err.message).toContain('100')
    expect(err.message).toContain('50')
  })

  it('stores amounts as properties', () => {
    const err = new InsufficientCreditsError(25, 10)
    expect(err.requiredCents).toBe(25)
    expect(err.availableCents).toBe(10)
  })

  it('has 402 status code', () => {
    expect(new InsufficientCreditsError(1, 0).statusCode).toBe(402)
  })

  it('handles zero amounts', () => {
    const err = new InsufficientCreditsError(0, 0)
    expect(err.requiredCents).toBe(0)
    expect(err.availableCents).toBe(0)
  })
})

describe('ToolNotFoundError (extended)', () => {
  it('includes slug in message', () => {
    const err = new ToolNotFoundError('my-awesome-tool')
    expect(err.message).toContain('my-awesome-tool')
  })

  it('has TOOL_NOT_FOUND code', () => {
    expect(new ToolNotFoundError('x').code).toBe('TOOL_NOT_FOUND')
  })

  it('has 404 status', () => {
    expect(new ToolNotFoundError('x').statusCode).toBe(404)
  })
})

describe('ToolDisabledError (extended)', () => {
  it('includes slug in message', () => {
    const err = new ToolDisabledError('disabled-tool')
    expect(err.message).toContain('disabled-tool')
    expect(err.message).toContain('not active')
  })

  it('has TOOL_DISABLED code', () => {
    expect(new ToolDisabledError('x').code).toBe('TOOL_DISABLED')
  })

  it('has 403 status', () => {
    expect(new ToolDisabledError('x').statusCode).toBe(403)
  })
})

describe('RateLimitedError (extended)', () => {
  it('stores retryAfterMs', () => {
    const err = new RateLimitedError(10000)
    expect(err.retryAfterMs).toBe(10000)
  })

  it('message includes retry time', () => {
    const err = new RateLimitedError(3000)
    expect(err.message).toContain('3000')
  })

  it('has 429 status', () => {
    expect(new RateLimitedError(100).statusCode).toBe(429)
  })

  it('has RATE_LIMITED code', () => {
    expect(new RateLimitedError(100).code).toBe('RATE_LIMITED')
  })
})

describe('SettleGridUnavailableError (extended)', () => {
  it('has default message', () => {
    const err = new SettleGridUnavailableError()
    expect(err.message).toContain('unavailable')
  })

  it('accepts custom message', () => {
    const err = new SettleGridUnavailableError('Custom unavailable')
    expect(err.message).toBe('Custom unavailable')
  })

  it('has 503 status', () => {
    expect(new SettleGridUnavailableError().statusCode).toBe(503)
  })

  it('has SERVER_ERROR code', () => {
    expect(new SettleGridUnavailableError().code).toBe('SERVER_ERROR')
  })
})

describe('NetworkError (extended)', () => {
  it('has default message', () => {
    const err = new NetworkError()
    expect(err.message).toContain('Network error')
  })

  it('accepts custom message', () => {
    const err = new NetworkError('DNS failure')
    expect(err.message).toBe('DNS failure')
  })

  it('has 503 status', () => {
    expect(new NetworkError().statusCode).toBe(503)
  })

  it('has NETWORK_ERROR code', () => {
    expect(new NetworkError().code).toBe('NETWORK_ERROR')
  })
})

describe('TimeoutError (extended)', () => {
  it('message includes timeout value', () => {
    const err = new TimeoutError(5000)
    expect(err.message).toContain('5000')
  })

  it('has 504 status', () => {
    expect(new TimeoutError(1000).statusCode).toBe(504)
  })

  it('has TIMEOUT code', () => {
    expect(new TimeoutError(1000).code).toBe('TIMEOUT')
  })

  it('serializes correctly', () => {
    const json = new TimeoutError(2000).toJSON()
    expect(json.statusCode).toBe(504)
    expect(json.code).toBe('TIMEOUT')
    expect(json.error).toContain('2000')
  })
})

describe('Error inheritance chain', () => {
  it('all errors are instances of Error', () => {
    const errors = [
      new InvalidKeyError(),
      new InsufficientCreditsError(1, 0),
      new ToolNotFoundError('x'),
      new ToolDisabledError('x'),
      new RateLimitedError(100),
      new SettleGridUnavailableError(),
      new NetworkError(),
      new TimeoutError(1000),
    ]
    errors.forEach(err => {
      expect(err).toBeInstanceOf(Error)
      expect(err).toBeInstanceOf(SettleGridError)
    })
  })

  it('all errors have toJSON method', () => {
    const errors = [
      new InvalidKeyError(),
      new InsufficientCreditsError(1, 0),
      new ToolNotFoundError('x'),
      new ToolDisabledError('x'),
      new RateLimitedError(100),
      new SettleGridUnavailableError(),
      new NetworkError(),
      new TimeoutError(1000),
    ]
    errors.forEach(err => {
      const json = err.toJSON()
      expect(json.error).toBeDefined()
      expect(json.code).toBeDefined()
      expect(json.statusCode).toBeDefined()
    })
  })

  it('each error has a distinct name property', () => {
    const names = [
      new InvalidKeyError().name,
      new InsufficientCreditsError(1, 0).name,
      new ToolNotFoundError('x').name,
      new ToolDisabledError('x').name,
      new RateLimitedError(100).name,
      new SettleGridUnavailableError().name,
      new NetworkError().name,
      new TimeoutError(1000).name,
    ]
    const uniqueNames = new Set(names)
    expect(uniqueNames.size).toBe(8)
  })
})
