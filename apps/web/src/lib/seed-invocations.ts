/**
 * Seed Invocations — Queue test calls after tool publish
 *
 * After a tool is published via quick-publish, queues 3 test calls
 * via the Smart Proxy using a system consumer account.
 * Fire-and-forget: does not block the publish response.
 */

import { logger } from './logger'

const SEED_CALL_COUNT = 3
const SEED_DELAY_MS = 2000 // Stagger calls by 2 seconds

/**
 * Sends test invocations to a newly published tool's proxy endpoint.
 * Uses the internal proxy URL with a system API key.
 * Fire-and-forget: errors are logged but never thrown.
 */
export function queueSeedInvocations(opts: {
  toolSlug: string
  proxyUrl: string
}): void {
  const { toolSlug, proxyUrl } = opts

  // Fire-and-forget: schedule calls asynchronously
  void (async () => {
    const systemApiKey = process.env.SETTLEGRID_SYSTEM_API_KEY

    if (!systemApiKey) {
      logger.warn('seed_invocations.no_system_key', { toolSlug })
      return
    }

    logger.info('seed_invocations.starting', { toolSlug, count: SEED_CALL_COUNT })

    for (let i = 0; i < SEED_CALL_COUNT; i++) {
      try {
        // Stagger calls to avoid burst
        if (i > 0) {
          await new Promise((resolve) => setTimeout(resolve, SEED_DELAY_MS))
        }

        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://settlegrid.ai'
        const seedUrl = `${appUrl}/api/proxy/${toolSlug}`

        const response = await fetch(seedUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': systemApiKey,
            'x-seed-invocation': 'true',
          },
          body: JSON.stringify({
            _seed: true,
            _invocation: i + 1,
            timestamp: new Date().toISOString(),
          }),
          signal: AbortSignal.timeout(10_000),
        })

        logger.info('seed_invocations.call_complete', {
          toolSlug,
          invocation: i + 1,
          status: response.status,
        })
      } catch (err) {
        logger.error('seed_invocations.call_failed', { toolSlug, invocation: i + 1 }, err)
        // Continue with remaining calls
      }
    }

    logger.info('seed_invocations.complete', { toolSlug })
  })()
}
