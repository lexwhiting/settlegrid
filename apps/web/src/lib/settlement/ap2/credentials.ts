/**
 * AP2 Credentials Provider
 *
 * Implements the core AP2 Credentials Provider skills:
 *   - get_eligible_payment_methods
 *   - provision_credentials
 *   - process_payment
 *   - verify_intent_mandate
 *   - verify_cart_mandate
 *
 * In production, JWT signing would use ES256K key pairs stored in env.
 * For MVP, uses HMAC-SHA256 as a signing stand-in.
 */

import crypto from 'crypto'
import { logger } from '@/lib/logger'
import type {
  PaymentCredential,
  IntentMandate,
  CartMandate,
  PaymentMandate,
  VDCClaims,
} from './types'

// ---- JWT Signing (HMAC-SHA256 stand-in for ES256K) ----------------------------

export function signJwt(payload: VDCClaims, secretKey: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${header}.${body}`)
    .digest('base64url')
  return `${header}.${body}.${signature}`
}

export function verifyJwt(token: string, secretKey: string): VDCClaims | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null

  const expectedSig = crypto
    .createHmac('sha256', secretKey)
    .update(`${parts[0]}.${parts[1]}`)
    .digest('base64url')

  if (parts[2] !== expectedSig) return null

  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString()) as VDCClaims
  } catch {
    return null
  }
}

// ---- Skill: get_eligible_payment_methods ------------------------------------

/**
 * Returns payment methods available for a given consumer.
 * In production, this would query DB for balance and Stripe cards.
 * For now, returns a SettleGrid credit balance method.
 */
export function getEligiblePaymentMethods(
  consumerId: string,
  balanceCents: number = 0,
  hasStripeCard: boolean = false
): PaymentCredential[] {
  const methods: PaymentCredential[] = []

  // 1. SettleGrid balance
  if (balanceCents > 0) {
    methods.push({
      id: `sg_balance_${consumerId.slice(0, 8)}`,
      type: 'settlegrid_balance',
      consumerId,
      displayName: 'SettleGrid Balance',
      balanceCents,
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      tokenRef: crypto.randomUUID(),
    })
  }

  // 2. Stripe card on file
  if (hasStripeCard) {
    methods.push({
      id: `sg_card_${consumerId.slice(0, 8)}`,
      type: 'stripe_card',
      consumerId,
      displayName: 'Card on File',
      lastFour: '****',
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
      tokenRef: crypto.randomUUID(),
    })
  }

  return methods
}

// ---- Skill: provision_credentials -------------------------------------------

/**
 * Creates a tokenized credential (VDC) for a consumer.
 * Returns a credential reference and a signed JWT.
 */
export function provisionCredentials(
  consumerId: string,
  paymentMethodType: 'settlegrid_balance' | 'stripe_card' | 'usdc',
  amountCents: number,
  currency: string,
  merchantId: string
): { credentialRef: string; vdc: string } {
  const secretKey = process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'

  const claims: VDCClaims = {
    iss: 'settlegrid.ai',
    sub: consumerId,
    aud: merchantId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    mandate_type: 'payment_credential',
    mandate_id: crypto.randomUUID(),
    payment_method: paymentMethodType,
    amount_cents: amountCents,
    currency,
  }

  const vdc = signJwt(claims, secretKey)
  const credentialRef = crypto.randomUUID()

  logger.info('ap2.credentials_provisioned', {
    consumerId,
    paymentMethodType,
    amountCents,
    credentialRef,
  })

  return { credentialRef, vdc }
}

// ---- Skill: verify_intent_mandate -------------------------------------------

export function verifyIntentMandate(mandate: IntentMandate): {
  valid: boolean
  reason?: string
} {
  // Check type
  if (mandate.type !== 'ap2.mandates.IntentMandate') {
    return { valid: false, reason: 'Invalid mandate type' }
  }

  // Check expiry
  if (new Date(mandate.expiresAt) < new Date()) {
    return { valid: false, reason: 'Intent mandate expired' }
  }

  // Check version
  if (mandate.version !== '0.1') {
    return { valid: false, reason: `Unsupported mandate version: ${mandate.version}` }
  }

  // In production, verify userSignature with the user's public key via ES256K.
  // For MVP, accept if structure is valid.
  if (!mandate.userSignature || !mandate.agentId || !mandate.nonce) {
    return { valid: false, reason: 'Missing required fields' }
  }

  // Validate shopping intent
  if (!mandate.shoppingIntent || typeof mandate.shoppingIntent.maxBudgetCents !== 'number') {
    return { valid: false, reason: 'Invalid shopping intent' }
  }

  return { valid: true }
}

// ---- Skill: verify_cart_mandate ---------------------------------------------

export function verifyCartMandate(mandate: CartMandate): {
  valid: boolean
  reason?: string
} {
  // Check type
  if (mandate.type !== 'ap2.mandates.CartMandate') {
    return { valid: false, reason: 'Invalid mandate type' }
  }

  // Check expiry
  if (new Date(mandate.expiresAt) < new Date()) {
    return { valid: false, reason: 'Cart mandate expired' }
  }

  // Check version
  if (mandate.version !== '0.1') {
    return { valid: false, reason: `Unsupported mandate version: ${mandate.version}` }
  }

  // Verify line item totals
  const computedTotal = mandate.lineItems.reduce(
    (sum, item) => sum + item.amountCents * item.quantity,
    0
  )
  if (computedTotal !== mandate.totalAmountCents) {
    return { valid: false, reason: 'Line item total mismatch' }
  }

  // Check required fields
  if (!mandate.merchantSignature || !mandate.merchantId) {
    return { valid: false, reason: 'Missing required fields' }
  }

  // Check line items are non-empty
  if (!mandate.lineItems || mandate.lineItems.length === 0) {
    return { valid: false, reason: 'Cart has no line items' }
  }

  return { valid: true }
}

// ---- Skill: process_payment -------------------------------------------------

export function processPayment(
  consumerId: string,
  mandate: PaymentMandate
): {
  success: boolean
  transactionId: string
  error?: string
} {
  const transactionId = crypto.randomUUID()

  // Verify the payment mandate structure
  if (!mandate.cartMandateRef || !mandate.paymentCredentialRef) {
    return { success: false, transactionId, error: 'Invalid payment mandate' }
  }

  // Validate amount
  if (mandate.amountCents <= 0) {
    return { success: false, transactionId, error: 'Invalid payment amount' }
  }

  switch (mandate.paymentMethod) {
    case 'settlegrid_balance': {
      logger.info('ap2.payment_processed', {
        consumerId,
        method: 'settlegrid_balance',
        amountCents: mandate.amountCents,
        transactionId,
      })
      return { success: true, transactionId }
    }

    case 'stripe_card': {
      logger.info('ap2.payment_processed', {
        consumerId,
        method: 'stripe_card',
        amountCents: mandate.amountCents,
        transactionId,
      })
      return { success: true, transactionId }
    }

    case 'usdc': {
      logger.info('ap2.payment_processed', {
        consumerId,
        method: 'usdc',
        amountCents: mandate.amountCents,
        transactionId,
      })
      return { success: true, transactionId }
    }

    default:
      return {
        success: false,
        transactionId,
        error: `Unsupported payment method: ${(mandate as PaymentMandate).paymentMethod}`,
      }
  }
}
