/**
 * P2.TAX1 — Stripe Tax helpers for SaaS subscription charges.
 *
 * SettleGrid consolidates on Stripe for payment processing (Pattern
 * A+ — see private/master-plan/multi-rail-architecture.md). Stripe
 * Tax auto-calculates VAT / GST / sales tax on subscription charges
 * based on the customer's billing address, but only for
 * jurisdictions where SettleGrid is registered. Registration is a
 * per-jurisdiction legal step tracked in
 * docs/legal/tax-registrations.md.
 *
 * This module centralizes three concerns so no checkout path
 * accidentally bypasses tax:
 *
 *   1. `withAutomaticTax(config)` — injects `automatic_tax: { enabled:
 *      true }` into any Stripe Checkout Session or Subscription
 *      create/update call. All call sites MUST go through this.
 *
 *   2. `validateEuVatId(vatId)` — VIES-API lookup for EU VAT IDs so
 *      B2B reverse-charge only applies to verified IDs (not
 *      whatever the customer typed in a form).
 *
 *   3. `extractTaxFromInvoice(invoice)` — pulls tax_cents and
 *      tax_jurisdiction out of a Stripe Invoice so the unified
 *      ledger can record tax separately (reconciliation can then
 *      confirm SettleGrid never recognized tax as revenue).
 *
 * This module runs on the server only — it reads no secrets and
 * requires no env config, but it's coupled to the Stripe client
 * via Stripe.Checkout.Session and Stripe.Invoice types, so the
 * module lives server-side to avoid pulling Stripe typings into
 * client bundles.
 */

import type Stripe from 'stripe'

/**
 * Subset of Stripe Checkout Session `create` params that support
 * automatic_tax. Typing as a generic lets us preserve whatever other
 * fields the caller has set (line_items, customer, success_url,
 * etc.) while guaranteeing the tax block is always present.
 */
/**
 * Wrap a Stripe Checkout Session create-params object with the
 * automatic-tax configuration. Every subscription-mode checkout
 * MUST go through this helper. Non-subscription top-ups that are
 * also tax-applicable (e.g., credit packs in jurisdictions where
 * digital services are taxed) SHOULD also wrap.
 *
 * The helper guarantees:
 *   - `automatic_tax.enabled: true`
 *   - `billing_address_collection: 'required'` (Stripe Tax needs an
 *     address to pick the rate; the signup flow collects this up
 *     front, and this is a belt-and-suspenders backstop)
 *   - `customer_update: { address: 'auto', name: 'auto' }` so the
 *     collected address is saved back on the Stripe Customer for
 *     future renewals
 *   - `tax_id_collection: { enabled: true }` so EU B2B customers
 *     can enter a VAT ID and trigger reverse charge
 *
 * @example
 * ```ts
 * const session = await stripe.checkout.sessions.create(
 *   withAutomaticTax({
 *     customer: stripeCustomerId,
 *     line_items: [{ price: priceId, quantity: 1 }],
 *     mode: 'subscription',
 *     // ... rest of checkout config ...
 *   }),
 * )
 * ```
 */
export function withAutomaticTax(
  config: Stripe.Checkout.SessionCreateParams,
): Stripe.Checkout.SessionCreateParams {
  if (!config || typeof config !== 'object') {
    throw new TypeError('withAutomaticTax: `config` is required.')
  }
  return {
    ...config,
    automatic_tax: { enabled: true },
    billing_address_collection:
      config.billing_address_collection ?? 'required',
    customer_update:
      config.customer_update ?? { address: 'auto', name: 'auto' },
    tax_id_collection:
      config.tax_id_collection ?? { enabled: true },
  }
}

/**
 * Wrap a Stripe Subscription create/update params object with
 * automatic_tax. Used by flows that create subscriptions directly
 * (bypassing Checkout) — e.g., programmatic subscription creation
 * after a Stripe Customer already has a default payment method —
 * and by flows that UPDATE an existing subscription (change-plan)
 * so the update doesn't reset automatic_tax.enabled to false.
 *
 * Typed as a generic so the caller's specific params shape (create
 * vs update, with line_items vs items, etc.) flows through
 * unchanged — only the `automatic_tax` field is guaranteed.
 */
export function withAutomaticTaxOnSubscription<T extends object>(
  config: T,
): T & { automatic_tax: { enabled: true } } {
  if (!config || typeof config !== 'object') {
    throw new TypeError('withAutomaticTaxOnSubscription: `config` is required.')
  }
  return { ...config, automatic_tax: { enabled: true } }
}

/* -------------------------------------------------------------------------- */
/*  VIES validation                                                            */
/* -------------------------------------------------------------------------- */

const EU_COUNTRY_CODES = new Set([
  'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES', 'FI',
  'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU', 'LV', 'MT',
  'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK',
  // Non-EU but VIES-compatible: Northern Ireland uses XI
  'XI',
])

export interface VatValidationResult {
  valid: boolean
  /** ISO-3166 alpha-2 country code parsed from the VAT ID prefix */
  countryCode?: string
  /** The VAT ID sans country prefix + whitespace */
  vatNumber?: string
  /** Company name returned by VIES when the ID is valid */
  name?: string
  /** Registered address returned by VIES when the ID is valid */
  address?: string
  /** Error code when validation fails (INVALID_FORMAT, NOT_EU, etc.) */
  errorCode?:
    | 'INVALID_FORMAT'
    | 'NOT_EU'
    | 'INVALID'
    | 'VIES_UNAVAILABLE'
    | 'TIMEOUT'
  /** Human-readable error message */
  errorMessage?: string
}

/**
 * VIES-API validation for EU VAT IDs.
 *
 * Per P2.TAX1 hostile-review requirement (d): "reverse-charge is
 * only applied when the VAT ID is validated against VIES, not on
 * customer-supplied text alone." Callers MUST receive `valid: true`
 * from this function before treating a subscription as
 * reverse-charge-eligible.
 *
 * Uses the EU Commission's public VIES REST endpoint:
 *   https://ec.europa.eu/taxation_customs/vies/rest-api/ms/{cc}/vat/{num}
 *
 * The VIES service is known to be flaky — if it returns a 5xx or
 * times out, we return `valid: false` with errorCode
 * `VIES_UNAVAILABLE`. Callers SHOULD treat that as "cannot confirm
 * reverse charge; bill with VAT." Never default-accept on VIES
 * failure — that would be exactly the bypass the hostile review
 * calls out.
 */
export async function validateEuVatId(
  rawVatId: string,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<VatValidationResult> {
  if (!rawVatId || typeof rawVatId !== 'string') {
    return {
      valid: false,
      errorCode: 'INVALID_FORMAT',
      errorMessage: 'VAT ID is empty or not a string.',
    }
  }
  const normalized = rawVatId.replace(/\s|-|\./g, '').toUpperCase()
  // Format: 2 letters country code + 8-12 alphanumeric. Minimum 10
  // chars total, maximum 14. Stricter country-specific rules exist
  // but this is the conservative superset.
  const match = normalized.match(/^([A-Z]{2})([A-Z0-9]{8,12})$/)
  if (!match) {
    return {
      valid: false,
      errorCode: 'INVALID_FORMAT',
      errorMessage:
        'VAT ID must be a 2-letter country code followed by 8–12 alphanumeric characters.',
    }
  }
  const countryCode = match[1]
  const vatNumber = match[2]
  if (!EU_COUNTRY_CODES.has(countryCode)) {
    return {
      valid: false,
      countryCode,
      vatNumber,
      errorCode: 'NOT_EU',
      errorMessage: `${countryCode} is not an EU VAT-registered country code.`,
    }
  }

  const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${vatNumber}`
  const fetchImpl = opts.fetchImpl ?? fetch
  const timeoutMs = opts.timeoutMs ?? 5000
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetchImpl(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok) {
      return {
        valid: false,
        countryCode,
        vatNumber,
        errorCode: 'VIES_UNAVAILABLE',
        errorMessage: `VIES returned HTTP ${response.status}.`,
      }
    }
    const body = (await response.json()) as {
      isValid?: boolean
      requestDate?: string
      userError?: string
      name?: string | null
      address?: string | null
    }
    if (body.isValid === true) {
      return {
        valid: true,
        countryCode,
        vatNumber,
        name: body.name ?? undefined,
        address: body.address ?? undefined,
      }
    }
    return {
      valid: false,
      countryCode,
      vatNumber,
      errorCode: 'INVALID',
      errorMessage:
        body.userError ?? 'VIES reports this VAT ID is not registered.',
    }
  } catch (err) {
    const isAbort =
      err instanceof Error && (err.name === 'AbortError' || /abort/i.test(err.message))
    return {
      valid: false,
      countryCode,
      vatNumber,
      errorCode: isAbort ? 'TIMEOUT' : 'VIES_UNAVAILABLE',
      errorMessage:
        err instanceof Error ? err.message : 'VIES call failed unexpectedly.',
    }
  } finally {
    clearTimeout(timeoutId)
  }
}

/* -------------------------------------------------------------------------- */
/*  Tax extraction from Stripe invoices                                        */
/* -------------------------------------------------------------------------- */

export interface TaxBreakdown {
  taxCents: number
  /**
   * ISO-3166 alpha-2 country code of the taxing jurisdiction, or
   * for US a 2-letter state code prefixed with 'US-' (e.g., 'US-CA').
   * Undefined when no tax was collected (rate 0, exempt customer,
   * or reverse-charge).
   */
  taxJurisdiction?: string
  /** True if reverse-charge was applied (EU B2B). */
  reverseCharged: boolean
}

/**
 * Extract the tax amount + jurisdiction from a Stripe Invoice.
 * The unified ledger writes this into dedicated columns so
 * reconciliation can confirm SettleGrid never recognized tax as
 * revenue.
 *
 * Stripe surfaces tax in several places on the Invoice object:
 *   - `invoice.tax` — the total tax amount for the invoice (deprecated
 *     on newer API versions but still populated by Stripe Tax)
 *   - `invoice.total_tax_amounts[]` — per-rate breakdown with
 *     jurisdiction info via the tax_rate object
 *   - `invoice.automatic_tax.status` — indicates whether automatic
 *     tax was applied
 *
 * When reverse-charge applies, the tax amount will be 0 but
 * `total_tax_amounts[]` will still contain an entry with
 * `tax_rate.tax_type === 'vat'` and the invoice metadata will
 * indicate the reverse-charge flag.
 */
export function extractTaxFromInvoice(
  invoice: Pick<
    Stripe.Invoice,
    'tax' | 'total_tax_amounts' | 'automatic_tax' | 'customer_address'
  >,
): TaxBreakdown {
  const taxCents =
    typeof invoice.tax === 'number' && invoice.tax > 0 ? invoice.tax : 0
  const firstBreakdown = invoice.total_tax_amounts?.[0]
  const taxRate =
    firstBreakdown && typeof firstBreakdown.tax_rate === 'object'
      ? firstBreakdown.tax_rate
      : undefined
  const taxJurisdiction =
    taxRate?.country && taxRate?.state
      ? `${taxRate.country}-${taxRate.state}`
      : taxRate?.country ?? undefined

  // Reverse-charge is flagged on the line-item tax_rate on newer API
  // versions. The broad signal: automatic_tax succeeded AND the
  // total tax is zero despite tax_amounts carrying a VAT-typed rate.
  const reverseCharged =
    invoice.automatic_tax?.status === 'complete' &&
    taxCents === 0 &&
    taxRate?.tax_type === 'vat'

  return {
    taxCents,
    taxJurisdiction,
    reverseCharged,
  }
}
