import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Hoisted Mocks ──────────────────────────────────────────────────────────

const mockRedis = vi.hoisted(() => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue('OK'),
}))

vi.mock('@/lib/redis', () => ({
  getRedis: () => mockRedis,
  tryRedis: async (fn: () => Promise<unknown>) => {
    try {
      return await fn()
    } catch {
      return null
    }
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

import {
  formatCurrency,
  convertCurrency,
  getExchangeRate,
  SUPPORTED_CURRENCIES,
  FALLBACK_RATES,
  isSupportedCurrency,
} from '@/lib/settlement/currency'

// ─── SUPPORTED_CURRENCIES ───────────────────────────────────────────────────

describe('SUPPORTED_CURRENCIES', () => {
  it('has exactly 5 currencies', () => {
    expect(Object.keys(SUPPORTED_CURRENCIES)).toHaveLength(5)
  })

  it('includes USD with correct properties', () => {
    expect(SUPPORTED_CURRENCIES.USD).toEqual({
      code: 'USD',
      name: 'US Dollar',
      symbol: '$',
      decimalPlaces: 2,
    })
  })

  it('includes EUR with correct properties', () => {
    expect(SUPPORTED_CURRENCIES.EUR).toEqual({
      code: 'EUR',
      name: 'Euro',
      symbol: '\u20AC',
      decimalPlaces: 2,
    })
  })

  it('includes GBP with correct properties', () => {
    expect(SUPPORTED_CURRENCIES.GBP).toEqual({
      code: 'GBP',
      name: 'British Pound',
      symbol: '\u00A3',
      decimalPlaces: 2,
    })
  })

  it('includes JPY with 0 decimal places', () => {
    expect(SUPPORTED_CURRENCIES.JPY.decimalPlaces).toBe(0)
  })

  it('includes USDC with 6 decimal places', () => {
    expect(SUPPORTED_CURRENCIES.USDC.decimalPlaces).toBe(6)
  })
})

// ─── formatCurrency ─────────────────────────────────────────────────────────

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    expect(formatCurrency(1050, 'USD')).toBe('$10.50')
  })

  it('formats USD with zero cents', () => {
    expect(formatCurrency(2000, 'USD')).toBe('$20.00')
  })

  it('formats EUR correctly', () => {
    expect(formatCurrency(999, 'EUR')).toBe('\u20AC9.99')
  })

  it('formats GBP correctly', () => {
    // 500 cents = 5.00 GBP
    expect(formatCurrency(500, 'GBP')).toBe('\u00A35.00')
  })

  it('formats JPY without decimal places', () => {
    const result = formatCurrency(15000, 'JPY')
    expect(result).toBe('\u00A515,000')
  })

  it('formats USDC with 6 decimal places', () => {
    const result = formatCurrency(1_000_000, 'USDC')
    expect(result).toBe('$1.000000 USDC')
  })

  it('formats zero amount', () => {
    expect(formatCurrency(0, 'USD')).toBe('$0.00')
  })
})

// ─── convertCurrency ────────────────────────────────────────────────────────

describe('convertCurrency', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // No API key set, so fallback rates will be used
    delete process.env.OPEN_EXCHANGE_RATES_API_KEY
  })

  it('same currency returns input unchanged', async () => {
    const result = await convertCurrency(1000, 'USD', 'USD')
    expect(result).toBe(1000)
  })

  it('handles zero amount', async () => {
    const result = await convertCurrency(0, 'USD', 'EUR')
    expect(result).toBe(0)
  })

  it('converts USD to EUR using fallback rates', async () => {
    const result = await convertCurrency(1000, 'USD', 'EUR')
    // 1000 cents * 0.926 = 926 EUR cents
    expect(result).toBe(Math.round(1000 * FALLBACK_RATES['USD/EUR']))
  })

  it('converts EUR to USD using fallback rates', async () => {
    const result = await convertCurrency(1000, 'EUR', 'USD')
    expect(result).toBe(Math.round(1000 * FALLBACK_RATES['EUR/USD']))
  })

  it('converts USDC to USD (1:1 stablecoin)', async () => {
    const result = await convertCurrency(5000, 'USDC', 'USD')
    expect(result).toBe(Math.round(5000 * FALLBACK_RATES['USDC/USD']))
  })

  it('converts USD to JPY using fallback rates', async () => {
    const result = await convertCurrency(100, 'USD', 'JPY')
    expect(result).toBe(Math.round(100 * FALLBACK_RATES['USD/JPY']))
  })
})

// ─── getExchangeRate ────────────────────────────────────────────────────────

describe('getExchangeRate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.OPEN_EXCHANGE_RATES_API_KEY
  })

  it('returns 1.0 for same currency', async () => {
    const rate = await getExchangeRate('USD', 'USD')
    expect(rate).toBe(1.0)
  })

  it('returns cached rate when available', async () => {
    mockRedis.get.mockResolvedValueOnce(1.12)

    const rate = await getExchangeRate('USD', 'EUR')
    expect(rate).toBe(1.12)
  })

  it('fetches and caches rate when not cached', async () => {
    mockRedis.get.mockResolvedValueOnce(null)

    const rate = await getExchangeRate('USD', 'EUR')
    expect(rate).toBe(FALLBACK_RATES['USD/EUR'])
    expect(mockRedis.set).toHaveBeenCalled()
  })
})

// ─── isSupportedCurrency ────────────────────────────────────────────────────

describe('isSupportedCurrency', () => {
  it('returns true for supported currencies', () => {
    expect(isSupportedCurrency('USD')).toBe(true)
    expect(isSupportedCurrency('EUR')).toBe(true)
    expect(isSupportedCurrency('GBP')).toBe(true)
    expect(isSupportedCurrency('JPY')).toBe(true)
    expect(isSupportedCurrency('USDC')).toBe(true)
  })

  it('returns false for unsupported currencies', () => {
    expect(isSupportedCurrency('BTC')).toBe(false)
    expect(isSupportedCurrency('CNY')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})
