/**
 * P3.K4 — B1.3: gas-wallet balance monitor.
 *
 * The gas wallet pays for every on-chain settlement (circle-nano + x402). If it
 * runs out of ETH, settlements fail (`submit-error GAS_WALLET_INSUFFICIENT`) and
 * rows freeze 'pending'. This module reads the wallet's native balance and
 * classifies it against WARN/CRITICAL thresholds so the cron can alert before
 * that happens.
 *
 * Split so the bug-prone threshold logic (`classifyGasBalance`) is pure +
 * unit-testable, while the viem I/O (`readGasWalletBalanceEth`) is a thin,
 * separately-mockable seam for the cron handler test.
 */
import { createPublicClient, http, formatEther } from 'viem'
import { base, baseSepolia } from 'viem/chains'
import { getBaseRpcUrl } from '@/lib/env'
import { getGasWalletAddress } from './circle-nano/settle-engine'

const CHAINS = {
  'eip155:8453': base,
  'eip155:84532': baseSepolia,
} as const
export type MonitoredNetwork = keyof typeof CHAINS

export type GasBalanceLevel = 'ok' | 'warn' | 'critical'

export interface GasBalanceThresholds {
  /** Below this (and >= criticalEth) → 'warn'. */
  warnEth: number
  /** Below this → 'critical'. */
  criticalEth: number
}

/**
 * Classify a gas-wallet ETH balance string against the thresholds. Pure.
 * Fails SAFE: an unparseable balance classifies as 'critical' (alert), never
 * 'ok' — a balance we can't read must not be silently treated as healthy.
 */
export function classifyGasBalance(balanceEth: string, t: GasBalanceThresholds): GasBalanceLevel {
  const n = Number(balanceEth)
  if (!Number.isFinite(n)) return 'critical'
  if (n < t.criticalEth) return 'critical'
  if (n < t.warnEth) return 'warn'
  return 'ok'
}

export interface GasWalletBalance {
  address: `0x${string}`
  balanceWei: bigint
  balanceEth: string
}

/**
 * Read the gas wallet's native ETH balance on a Base network. Returns null when
 * the gas-wallet key is unset (nothing to monitor — the rail is dark). RPC
 * errors propagate to the caller (the cron logs + reports them). Uses the
 * dedicated RPC if configured, else viem's public fallback (fine for a read).
 */
export async function readGasWalletBalanceEth(
  network: MonitoredNetwork = 'eip155:8453',
): Promise<GasWalletBalance | null> {
  const address = getGasWalletAddress()
  if (!address) return null
  const client = createPublicClient({ chain: CHAINS[network], transport: http(getBaseRpcUrl(network)) })
  const balanceWei = await client.getBalance({ address })
  return { address, balanceWei, balanceEth: formatEther(balanceWei) }
}
