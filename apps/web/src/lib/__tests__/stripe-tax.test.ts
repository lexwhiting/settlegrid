/**
 * P2.TAX1 — tests for Stripe Tax helpers.
 *
 * Covers the four hostile-review requirements from the P2.TAX1 spec:
 *   (a) no charges are created with automatic_tax: false accidentally
 *   (b) tax_cents is populated on every new ledger entry (no nulls)
 *   (c) the billing-address collection cannot be bypassed
 *   (d) reverse-charge is only applied when the VAT ID is validated
 *       against VIES, not on customer-supplied text alone
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  withAutomaticTax,
  withAutomaticTaxOnSubscription,
  validateEuVatId,
  extractTaxFromInvoice,
} from '../stripe-tax'

describe('withAutomaticTax — hostile-review (a) + (c): tax + billing-address cannot be bypassed', () => {
  it('injects automatic_tax.enabled: true into every config', () => {
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
    })
    expect(session.automatic_tax).toEqual({ enabled: true })
  })

  it('overrides caller-supplied automatic_tax.enabled=false', () => {
    // Belt-and-suspenders: even if a caller typos
    // `automatic_tax: { enabled: false }`, the helper must override.
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
      automatic_tax: { enabled: false },
    })
    expect(session.automatic_tax).toEqual({ enabled: true })
  })

  it('sets billing_address_collection to "required" by default', () => {
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
    })
    expect(session.billing_address_collection).toBe('required')
  })

  it('preserves caller-supplied billing_address_collection=required', () => {
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
      billing_address_collection: 'required',
    })
    expect(session.billing_address_collection).toBe('required')
  })

  it('OVERRIDES caller-supplied billing_address_collection="auto" (bypass defense)', () => {
    // Hostile-review II: check (c) says billing-address collection
    // cannot be bypassed. A caller setting 'auto' would silently
    // make the Stripe Checkout UI skip the address field, breaking
    // Stripe Tax rate calculation. The helper must force 'required'.
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
      billing_address_collection: 'auto',
    })
    expect(session.billing_address_collection).toBe('required')
  })

  it('enables tax_id_collection by default (EU B2B reverse-charge path)', () => {
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
    })
    expect(session.tax_id_collection).toEqual({ enabled: true })
  })

  it('sets customer_update so collected address is saved on the Customer', () => {
    const session = withAutomaticTax({
      mode: 'subscription',
      line_items: [{ price: 'price_x', quantity: 1 }],
    })
    expect(session.customer_update).toEqual({ address: 'auto', name: 'auto' })
  })

  it('preserves all caller fields (line_items, customer, success_url, metadata)', () => {
    const session = withAutomaticTax({
      customer: 'cus_X',
      line_items: [{ price: 'price_x', quantity: 1 }],
      mode: 'subscription',
      success_url: 'https://x/success',
      cancel_url: 'https://x/cancel',
      metadata: { developerId: 'd1' },
    })
    expect(session.customer).toBe('cus_X')
    expect(session.line_items).toEqual([{ price: 'price_x', quantity: 1 }])
    expect(session.success_url).toBe('https://x/success')
    expect(session.cancel_url).toBe('https://x/cancel')
    expect(session.metadata).toEqual({ developerId: 'd1' })
  })

  it('throws TypeError on null / undefined config', () => {
    expect(() =>
      withAutomaticTax(undefined as unknown as Parameters<typeof withAutomaticTax>[0]),
    ).toThrowError(/config/)
  })
})

describe('withAutomaticTaxOnSubscription — hostile-review (a): subscription update tax', () => {
  it('injects automatic_tax.enabled: true', () => {
    const params = withAutomaticTaxOnSubscription({
      items: [{ id: 'si_1', price: 'price_x' }],
    })
    expect(params.automatic_tax).toEqual({ enabled: true })
  })

  it('preserves caller fields (items, proration_behavior, metadata)', () => {
    const params = withAutomaticTaxOnSubscription({
      items: [{ id: 'si_1', price: 'price_x' }],
      proration_behavior: 'create_prorations' as const,
      metadata: { plan: 'builder' },
    })
    expect(params.items).toEqual([{ id: 'si_1', price: 'price_x' }])
    expect(params.proration_behavior).toBe('create_prorations')
    expect(params.metadata).toEqual({ plan: 'builder' })
  })

  it('overrides caller automatic_tax=false', () => {
    const params = withAutomaticTaxOnSubscription({
      items: [],
      automatic_tax: { enabled: false },
    })
    expect(params.automatic_tax).toEqual({ enabled: true })
  })

  it('throws on null config', () => {
    expect(() =>
      withAutomaticTaxOnSubscription(
        null as unknown as Parameters<typeof withAutomaticTaxOnSubscription>[0],
      ),
    ).toThrowError(/config/)
  })
})

describe('validateEuVatId — hostile-review (d): reverse-charge requires VIES validation', () => {
  it('rejects empty VAT ID', async () => {
    const result = await validateEuVatId('')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('INVALID_FORMAT')
  })

  it('rejects non-string VAT ID', async () => {
    const result = await validateEuVatId(
      42 as unknown as string,
    )
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('INVALID_FORMAT')
  })

  it('rejects malformed VAT ID (too short)', async () => {
    const result = await validateEuVatId('DE123')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('INVALID_FORMAT')
  })

  it('rejects non-EU country code (US)', async () => {
    const result = await validateEuVatId('US123456789')
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('NOT_EU')
    expect(result.countryCode).toBe('US')
  })

  it('normalizes whitespace + hyphens + dots in the input', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ isValid: true, name: 'Acme GmbH' }), {
        status: 200,
      }),
    )
    const result = await validateEuVatId('DE 123-456.7890', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(true)
    expect(fakeFetch).toHaveBeenCalledWith(
      expect.stringContaining('/DE/vat/1234567890'),
      expect.anything(),
    )
  })

  it('returns valid:true when VIES confirms', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          isValid: true,
          name: 'Acme GmbH',
          address: 'Berlin',
        }),
        { status: 200 },
      ),
    )
    const result = await validateEuVatId('DE123456789', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(true)
    expect(result.countryCode).toBe('DE')
    expect(result.name).toBe('Acme GmbH')
    expect(result.address).toBe('Berlin')
  })

  it('returns valid:false when VIES says the ID is not registered', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(
        JSON.stringify({ isValid: false, userError: 'NOT_REGISTERED' }),
        { status: 200 },
      ),
    )
    const result = await validateEuVatId('DE999999999', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('INVALID')
    expect(result.errorMessage).toContain('NOT_REGISTERED')
  })

  it('returns valid:false with VIES_UNAVAILABLE on 5xx (NEVER default-accept)', async () => {
    const fakeFetch = vi.fn(
      async () => new Response('', { status: 503 }),
    )
    const result = await validateEuVatId('DE123456789', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VIES_UNAVAILABLE')
  })

  it('returns valid:false with TIMEOUT when VIES exceeds the deadline', async () => {
    const fakeFetch = vi.fn(
      async () => {
        await new Promise((r) => setTimeout(r, 20))
        throw Object.assign(new Error('aborted'), { name: 'AbortError' })
      },
    )
    const result = await validateEuVatId('DE123456789', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
      timeoutMs: 5,
    })
    expect(result.valid).toBe(false)
    // Either TIMEOUT or VIES_UNAVAILABLE depending on which layer
    // reports first — both are valid "do NOT treat as reverse-
    // charge" signals.
    expect(['TIMEOUT', 'VIES_UNAVAILABLE']).toContain(result.errorCode)
  })

  it('returns valid:false with VIES_UNAVAILABLE on network error', async () => {
    const fakeFetch = vi.fn(async () => {
      throw new Error('network down')
    })
    const result = await validateEuVatId('DE123456789', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('VIES_UNAVAILABLE')
  })

  it('accepts XI (Northern Ireland) as a VIES-compatible non-EU code', async () => {
    const fakeFetch = vi.fn(async () =>
      new Response(JSON.stringify({ isValid: true }), { status: 200 }),
    )
    const result = await validateEuVatId('XI123456789', {
      fetchImpl: fakeFetch as unknown as typeof fetch,
    })
    expect(result.valid).toBe(true)
    expect(result.countryCode).toBe('XI')
  })
})

describe('extractTaxFromInvoice — hostile-review (b): tax_cents populated on ledger writes', () => {
  it('returns 0 tax when invoice has no tax', () => {
    const breakdown = extractTaxFromInvoice({
      tax: null,
      total_tax_amounts: [],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(0)
    expect(breakdown.reverseCharged).toBe(false)
  })

  it('extracts tax amount + country-level jurisdiction', () => {
    const breakdown = extractTaxFromInvoice({
      tax: 380,
      total_tax_amounts: [
        {
          amount: 380,
          inclusive: false,
          tax_rate: {
            country: 'DE',
            tax_type: 'vat',
            percentage: 19,
          },
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(380)
    expect(breakdown.taxJurisdiction).toBe('DE')
  })

  it('extracts state-level jurisdiction for US (country-state format)', () => {
    const breakdown = extractTaxFromInvoice({
      tax: 150,
      total_tax_amounts: [
        {
          amount: 150,
          inclusive: false,
          tax_rate: {
            country: 'US',
            state: 'CA',
            tax_type: 'sales_tax',
            percentage: 7.5,
          },
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(150)
    expect(breakdown.taxJurisdiction).toBe('US-CA')
  })

  it('flags reverse-charge when automatic_tax completed with zero tax on a VAT rate', () => {
    const breakdown = extractTaxFromInvoice({
      tax: 0,
      total_tax_amounts: [
        {
          amount: 0,
          inclusive: false,
          tax_rate: {
            country: 'DE',
            tax_type: 'vat',
            percentage: 0,
          },
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.reverseCharged).toBe(true)
    expect(breakdown.taxCents).toBe(0)
  })

  it('does not flag reverse-charge when automatic_tax failed', () => {
    const breakdown = extractTaxFromInvoice({
      tax: 0,
      total_tax_amounts: [
        {
          amount: 0,
          inclusive: false,
          tax_rate: {
            country: 'DE',
            tax_type: 'vat',
            percentage: 19,
          },
        },
      ],
      automatic_tax: { status: 'failed', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.reverseCharged).toBe(false)
  })

  it('falls back to summing total_tax_amounts when invoice.tax is null (newer API)', () => {
    // Hostile-review II: newer Stripe API versions return null for
    // invoice.tax — the breakdown moves entirely to
    // total_tax_amounts[]. Without this fallback, taxCents would
    // silently be 0 and the ledger would under-report collected tax.
    const breakdown = extractTaxFromInvoice({
      tax: null,
      total_tax_amounts: [
        {
          amount: 380,
          inclusive: false,
          tax_rate: { country: 'DE', tax_type: 'vat', percentage: 19 },
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(380)
    expect(breakdown.taxJurisdiction).toBe('DE')
  })

  it('sums total_tax_amounts across multiple rate entries (composite tax)', () => {
    // US sales tax often splits state + county. Stripe Tax models
    // this as two entries in total_tax_amounts[]. Both must be
    // summed to get the total collected tax.
    const breakdown = extractTaxFromInvoice({
      tax: null,
      total_tax_amounts: [
        {
          amount: 150,
          inclusive: false,
          tax_rate: { country: 'US', state: 'CA', tax_type: 'sales_tax' },
        },
        {
          amount: 50,
          inclusive: false,
          tax_rate: { country: 'US', state: 'CA', tax_type: 'sales_tax' },
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(200)
  })

  it('ignores negative / zero entries in the fallback sum', () => {
    const breakdown = extractTaxFromInvoice({
      tax: null,
      total_tax_amounts: [
        { amount: 100, inclusive: false, tax_rate: { country: 'DE', tax_type: 'vat' } },
        { amount: -5, inclusive: false, tax_rate: { country: 'DE', tax_type: 'vat' } },
        { amount: 0, inclusive: false, tax_rate: { country: 'DE', tax_type: 'vat' } },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(100)
  })

  it('handles non-object tax_rate (string ID) by treating as no jurisdiction', () => {
    const breakdown = extractTaxFromInvoice({
      tax: 100,
      total_tax_amounts: [
        {
          amount: 100,
          inclusive: false,
          tax_rate: 'txr_expanded_placeholder',
        },
      ],
      automatic_tax: { status: 'complete', enabled: true, liability: null },
      customer_address: null,
    } as unknown as Parameters<typeof extractTaxFromInvoice>[0])
    expect(breakdown.taxCents).toBe(100)
    expect(breakdown.taxJurisdiction).toBeUndefined()
  })
})
