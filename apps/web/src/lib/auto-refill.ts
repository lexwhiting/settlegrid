import Stripe from 'stripe'
import { eq, and } from 'drizzle-orm'
import { db } from './db'
import { consumers, consumerToolBalances, purchases } from './db/schema'
import { getRedis, tryRedis } from './redis'
import { logger } from './logger'
import { getStripeSecretKey } from './env'

function getStripe(): Stripe {
  return new Stripe(getStripeSecretKey(), { apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion })
}

function autoRefillLockKey(consumerId: string, toolId: string): string {
  return `autorefill:lock:${consumerId}:${toolId}`
}

export interface AutoRefillResult {
  triggered: boolean
  reason: string
  amountCents?: number
  paymentIntentId?: string
}

/**
 * Trigger auto-refill for a consumer's tool balance.
 * Creates a Stripe PaymentIntent with off_session=true (no redirect needed).
 * Debounced via Redis lock with 1hr TTL to prevent duplicate charges.
 */
export async function triggerAutoRefill(
  consumerId: string,
  toolId: string
): Promise<AutoRefillResult> {
  // 1. Check Redis debounce lock
  const redis = getRedis()
  const lockKey = autoRefillLockKey(consumerId, toolId)
  const locked = await tryRedis(() => redis.get(lockKey))
  if (locked) {
    return { triggered: false, reason: 'ALREADY_LOCKED' }
  }

  // 2. Get consumer and balance info
  const [balance] = await db
    .select({
      autoRefill: consumerToolBalances.autoRefill,
      autoRefillAmountCents: consumerToolBalances.autoRefillAmountCents,
      autoRefillThresholdCents: consumerToolBalances.autoRefillThresholdCents,
      balanceCents: consumerToolBalances.balanceCents,
    })
    .from(consumerToolBalances)
    .where(
      and(
        eq(consumerToolBalances.consumerId, consumerId),
        eq(consumerToolBalances.toolId, toolId)
      )
    )
    .limit(1)

  if (!balance || !balance.autoRefill) {
    return { triggered: false, reason: 'AUTO_REFILL_DISABLED' }
  }

  // Only trigger if balance is below threshold
  if (balance.balanceCents >= balance.autoRefillThresholdCents) {
    return { triggered: false, reason: 'ABOVE_THRESHOLD' }
  }

  // 3. Get consumer's payment method
  const [consumer] = await db
    .select({
      stripeCustomerId: consumers.stripeCustomerId,
      defaultPaymentMethodId: consumers.defaultPaymentMethodId,
    })
    .from(consumers)
    .where(eq(consumers.id, consumerId))
    .limit(1)

  if (!consumer?.stripeCustomerId || !consumer?.defaultPaymentMethodId) {
    return { triggered: false, reason: 'NO_PAYMENT_METHOD' }
  }

  // 4. Set lock before charging (1hr TTL)
  await tryRedis(() => redis.set(lockKey, '1', { ex: 3600 }))

  try {
    // 5. Create and confirm PaymentIntent
    const stripe = getStripe()
    const amountCents = balance.autoRefillAmountCents

    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: 'usd',
      customer: consumer.stripeCustomerId,
      payment_method: consumer.defaultPaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: {
        consumerId,
        toolId,
        type: 'auto_refill',
        amountCents: String(amountCents),
      },
    })

    // 6. Record the purchase
    await db.insert(purchases).values({
      consumerId,
      toolId,
      amountCents,
      stripePaymentIntentId: paymentIntent.id,
      status: paymentIntent.status === 'succeeded' ? 'completed' : 'pending',
    })

    logger.info('auto_refill.triggered', {
      consumerId,
      toolId,
      amountCents,
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status,
    })

    return {
      triggered: true,
      reason: 'SUCCESS',
      amountCents,
      paymentIntentId: paymentIntent.id,
    }
  } catch (error) {
    // Card decline or other Stripe error
    logger.error('auto_refill.failed', { consumerId, toolId }, error)

    // Disable auto-refill on failure
    await db
      .update(consumerToolBalances)
      .set({ autoRefill: false })
      .where(
        and(
          eq(consumerToolBalances.consumerId, consumerId),
          eq(consumerToolBalances.toolId, toolId)
        )
      )

    // Remove lock so they can re-enable and retry
    await tryRedis(() => redis.del(lockKey))

    return { triggered: false, reason: 'PAYMENT_FAILED' }
  }
}

/**
 * Check if auto-refill should be triggered after a deduction.
 * Call this asynchronously after balance deduction in metering.
 */
export async function maybeAutoRefill(
  consumerId: string,
  toolId: string,
  remainingBalanceCents: number
): Promise<void> {
  try {
    // Quick check: get threshold from balance record
    const [balance] = await db
      .select({
        autoRefill: consumerToolBalances.autoRefill,
        autoRefillThresholdCents: consumerToolBalances.autoRefillThresholdCents,
      })
      .from(consumerToolBalances)
      .where(
        and(
          eq(consumerToolBalances.consumerId, consumerId),
          eq(consumerToolBalances.toolId, toolId)
        )
      )
      .limit(1)

    if (!balance?.autoRefill) return
    if (remainingBalanceCents >= balance.autoRefillThresholdCents) return

    // Trigger auto-refill (handles its own debouncing)
    await triggerAutoRefill(consumerId, toolId)
  } catch (error) {
    logger.error('auto_refill.check_failed', { consumerId, toolId }, error)
  }
}
