/**
 * P3.K4 — B1.3: gas-wallet balance monitor cron.
 *
 * Alerts (email) when the gas wallet's Base-mainnet ETH balance falls below a
 * threshold, so settlements never freeze for lack of gas. Scheduled every 6h
 * in apps/web/vercel.json.
 *
 * Base mainnet is the only LIVE settlement network; Base Sepolia is testnet
 * (free gas) and intentionally NOT monitored here.
 *
 * DEBT / strategic (founder-facing, NOT code): each on-chain settlement costs
 * ~$0.005-0.02 in gas while circle-nano settles sub-cent payments, so
 * per-settlement gas economics is the thing to watch at scale (ties to the
 * protocol's batching idea). This monitor guards LIVENESS, not that economics.
 */
import { NextRequest } from 'next/server'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { logger } from '@/lib/logger'
import { getCronSecret } from '@/lib/env'
import { apiLimiter, checkRateLimit, getClientIp } from '@/lib/rate-limit'
import { sendEmail, gasWalletLowEmail } from '@/lib/email'
import { readGasWalletBalanceEth, classifyGasBalance } from '@/lib/settlement/gas-wallet-monitor'

export const maxDuration = 60

// Alerts go to the founder's inbox by default; override with ADMIN_EMAIL in prod.
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'lexwhiting@gmail.com'

const NETWORK = 'eip155:8453' as const
const NETWORK_LABEL = 'Base mainnet'

// ETH thresholds. WARN leaves runway to refill; CRITICAL means settlements are
// at imminent risk of freezing. Both levels send the same low-balance alert;
// the level only sets log severity.
const WARN_ETH = 0.004
const CRITICAL_ETH = 0.0015

export async function GET(request: NextRequest) {
  try {
    const ip = getClientIp(request.headers)
    const rl = await checkRateLimit(apiLimiter, `cron-gas-balance:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const authHeader = request.headers.get('authorization')
    const cronSecret = getCronSecret()
    if (!cronSecret) {
      logger.error('cron.gas_balance.no_secret', { msg: 'CRON_SECRET not configured' })
      return errorResponse('CRON_SECRET not configured', 500, 'CONFIG_ERROR')
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401, 'UNAUTHORIZED')
    }

    const balance = await readGasWalletBalanceEth(NETWORK)
    if (!balance) {
      // Gas wallet not configured → nothing to monitor (the on-chain rails are dark).
      logger.info('cron.gas_balance.not_configured', { network: NETWORK })
      return successResponse({ checked: false, reason: 'gas wallet not configured' })
    }

    const level = classifyGasBalance(balance.balanceEth, { warnEth: WARN_ETH, criticalEth: CRITICAL_ETH })

    if (level !== 'ok') {
      const { subject, html } = gasWalletLowEmail(ADMIN_EMAIL, balance.balanceEth, NETWORK_LABEL)
      await sendEmail({ to: ADMIN_EMAIL, subject, html })
      logger[level === 'critical' ? 'error' : 'warn']('cron.gas_balance.low', {
        network: NETWORK,
        address: balance.address,
        balanceEth: balance.balanceEth,
        level,
        warnEth: WARN_ETH,
        criticalEth: CRITICAL_ETH,
      })
    } else {
      logger.info('cron.gas_balance.ok', { network: NETWORK, balanceEth: balance.balanceEth })
    }

    return successResponse({
      checked: true,
      network: NETWORK,
      address: balance.address,
      balanceEth: balance.balanceEth,
      level,
      thresholds: { warnEth: WARN_ETH, criticalEth: CRITICAL_ETH },
      alerted: level !== 'ok',
    })
  } catch (error) {
    logger.error('cron.gas_balance.error', {}, error)
    return internalErrorResponse(error)
  }
}
