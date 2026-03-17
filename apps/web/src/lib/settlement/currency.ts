/**
 * Multi-currency support for SettleGrid.
 *
 * Supports USD, EUR, GBP, JPY, and USDC with FX rate caching via Redis.
 * Falls back to hardcoded rates when the external API is unavailable.
 */

import { getRedis, tryRedis } from '@/lib/redis'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export type SupportedCurrency = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'USDC'

export interface CurrencyInfo {
  code: SupportedCurrency
  name: string
  symbol: string
  decimalPlaces: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES: Record<SupportedCurrency, CurrencyInfo> = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '\u20AC', decimalPlaces: 2 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '\u00A3', decimalPlaces: 2 },
  JPY: { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5', decimalPlaces: 0 },
  USDC: { code: 'USDC', name: 'USD Coin', symbol: '$', decimalPlaces: 6 },
}

/**
 * Fallback FX rates (USD-based) used when external API is unavailable.
 */
export const FALLBACK_RATES: Record<string, number> = {
  'EUR/USD': 1.08,
  'GBP/USD': 1.27,
  'JPY/USD': 0.0067,
  'USDC/USD': 1.0,
  'USD/EUR': 0.926,
  'USD/GBP': 0.787,
  'USD/JPY': 149.5,
  'USD/USDC': 1.0,
  // Cross rates (computed from USD pairs)
  'EUR/GBP': 0.729,
  'GBP/EUR': 1.371,
  'EUR/JPY': 161.46,
  'JPY/EUR': 0.006194,
  'GBP/JPY': 189.865,
  'JPY/GBP': 0.005267,
  'EUR/USDC': 1.08,
  'USDC/EUR': 0.926,
  'GBP/USDC': 1.27,
  'USDC/GBP': 0.787,
  'JPY/USDC': 0.0067,
  'USDC/JPY': 149.5,
}

const FX_CACHE_KEY = 'fx:rates'
const FX_CACHE_TTL = 3600 // 1 hour

// ─── Rate Fetching ──────────────────────────────────────────────────────────

/**
 * Fetch live FX rates from Open Exchange Rates API.
 * Falls back to hardcoded rates if API is unavailable.
 */
async function fetchRates(): Promise<Record<string, number>> {
  const apiKey = process.env.OPEN_EXCHANGE_RATES_API_KEY
  if (!apiKey) {
    logger.warn('currency.no_api_key', { message: 'Using fallback exchange rates' })
    return FALLBACK_RATES
  }

  try {
    const res = await fetch(
      `https://openexchangerates.org/api/latest.json?app_id=${apiKey}&symbols=EUR,GBP,JPY`,
      { signal: AbortSignal.timeout(5000) }
    )

    if (!res.ok) throw new Error(`OXR API returned ${res.status}`)

    const data = (await res.json()) as { rates: Record<string, number> }
    const rates: Record<string, number> = {}

    for (const [currency, rate] of Object.entries(data.rates)) {
      rates[`USD/${currency}`] = rate
      rates[`${currency}/USD`] = 1 / rate
    }
    rates['USDC/USD'] = 1.0
    rates['USD/USDC'] = 1.0

    return rates
  } catch (err) {
    logger.error('currency.fetch_rates_failed', {}, err)
    return FALLBACK_RATES
  }
}

// ─── Exchange Rate ──────────────────────────────────────────────────────────

/**
 * Get the exchange rate between two currencies (with Redis caching).
 */
export async function getExchangeRate(
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) return 1.0

  const redis = getRedis()
  const cacheKey = `${FX_CACHE_KEY}:${from}/${to}`

  // Try cache first
  const cached = await tryRedis(() => redis.get<number>(cacheKey))
  if (cached !== null) return cached

  // Fetch fresh rates
  const rates = await fetchRates()
  const key = `${from}/${to}`
  const rate = rates[key] ?? FALLBACK_RATES[key] ?? 1.0

  // Cache for 1 hour
  await tryRedis(() => redis.set(cacheKey, rate, { ex: FX_CACHE_TTL }))

  return rate
}

// ─── Conversion ─────────────────────────────────────────────────────────────

/**
 * Convert an amount from one currency to another.
 * Amounts are in the smallest unit (cents for USD/EUR/GBP, yen for JPY, micro-units for USDC).
 */
export async function convertCurrency(
  amountCents: number,
  from: SupportedCurrency,
  to: SupportedCurrency
): Promise<number> {
  if (from === to) return amountCents
  if (amountCents === 0) return 0

  const rate = await getExchangeRate(from, to)
  return Math.round(amountCents * rate)
}

// ─── Formatting ─────────────────────────────────────────────────────────────

/**
 * Format an amount in the smallest unit for display.
 * Handles decimal places per currency (JPY has 0, USDC has 6, others have 2).
 */
export function formatCurrency(amountCents: number, currency: SupportedCurrency): string {
  const info = SUPPORTED_CURRENCIES[currency]
  if (!info) return `${amountCents} ${currency}`

  switch (currency) {
    case 'JPY': {
      // JPY has no decimal places; amountCents IS the yen amount
      return `\u00A5${amountCents.toLocaleString()}`
    }
    case 'USDC': {
      // USDC has 6 decimal places in smallest unit
      const amount = amountCents / 1_000_000
      return `$${amount.toFixed(6)} USDC`
    }
    default: {
      // USD, EUR, GBP use cents
      const amount = amountCents / 100
      return `${info.symbol}${amount.toFixed(2)}`
    }
  }
}

/**
 * Validate that a currency code is supported.
 */
export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return code in SUPPORTED_CURRENCIES
}
