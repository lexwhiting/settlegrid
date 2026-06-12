/**
 * Circle Nanopayments — on-chain settlement ENGINE (P3.K4 A2), Layer 1.
 *
 * Pure viem mechanics: pre-submit guards, the EIP-3009 transferWithAuthorization
 * write via SettleGrid's gas wallet, and a CONFIRMED-receipt wait. NO database /
 * Redis / idempotency — the orchestrator (settle.ts) owns those. Split from the
 * orchestrator so each layer is independently testable (engine ↔ mocked viem;
 * orchestrator ↔ mocked engine).
 *
 * Broadcast is NOT settlement for a money rail: a hash from writeContract only
 * means "accepted into the mempool." We wait for a receipt and branch on its
 * status; a revert or a timeout is surfaced distinctly so the orchestrator never
 * records an unconfirmed/reverted tx as 'settled'.
 *
 * On-chain constants (USDC addresses, the transferWithAuthorization ABI, the
 * EIP-712 domain) were ground-truthed against the LIVE Base mainnet + Base
 * Sepolia contracts on 2026-05-30; the pinned values are regression-guarded in
 * __tests__/onchain-constants.test.ts.
 */

import {
  createWalletClient,
  createPublicClient,
  http,
  type Address,
  type Hex,
  WaitForTransactionReceiptTimeoutError,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { base, baseSepolia } from 'viem/chains'
import { EIP3009_ABI } from '../x402/verify'
import { USDC_ADDRESSES } from '../x402/types'
import type { Eip3009SettleProof } from '../eip3009/types'
import { getBaseRpcUrl } from '@/lib/env'

/** The only networks we pin USDC + the EIP-712 domain for; anything else fails closed.
 * Exported (read-only) so the (G) no-drift invariant test can pin
 * CANONICAL_X402_NETWORKS == keys(SUPPORTED_CHAINS) against the real engine set. */
export const SUPPORTED_CHAINS = {
  'eip155:8453': base,
  'eip155:84532': baseSepolia,
} as const
type SupportedNetwork = keyof typeof SUPPORTED_CHAINS

/** Receipt-wait timeout (ms). Base block ~2s ⇒ 30s ≈ 15 blocks; well under the route's maxDuration=60s. */
export const RECEIPT_TIMEOUT_MS = 30_000

/**
 * (U) Reconciler-only RPC budget. The reconciler asks "is it mined NOW?" on a 15-min
 * rotation — patience buys nothing there, and unbounded patience starves the run's
 * detectors (the P4 ③-escalation). Worst per call = (RETRY_COUNT+1) × TIMEOUT_MS + 150ms
 * backoff = 6.15s; worst per examination (receipt + reverted-branch nonce read) = 12.3s,
 * inside the 20s tail behind the 40s examination budget (route maxDuration 60s).
 * ③ caveat — the 6.15s figure is the TIMER-bound shape, not an adversarial bound: viem
 * honors a 429 Retry-After header as the retry delay (server-controlled, unbounded —
 * buildRequest.js), and the per-attempt timeout binds time-to-HEADERS (a drip-feed
 * response body escapes it). Funds-safe either way; detector emission never depends on
 * this arithmetic — the detectors run BEFORE the loop by construction (reconcile.ts).
 * The LIVE settle paths deliberately keep viem defaults (10s × 3 retries — the buyer is
 * on the line); publicClientFor must stay byte-identical (pinned by
 * transport-isolation.test.ts).
 */
export const RECONCILER_RPC_TIMEOUT_MS = 3_000
export const RECONCILER_RPC_RETRY_COUNT = 1

export type CircleNanoSettleErrorCode =
  | 'UNSUPPORTED_NETWORK'
  | 'GAS_WALLET_NOT_CONFIGURED'
  | 'GAS_WALLET_INSUFFICIENT'
  | 'SETTLEMENT_RPC_ERROR'

/** Discriminated result of an on-chain settlement attempt. */
export type CircleNanoOnChainResult =
  /** Receipt confirmed `success` — the USDC moved. */
  | { kind: 'settled'; txHash: Hex }
  /** Receipt confirmed `reverted`. `nonceConsumed` = the (from,nonce) is spent on-chain anyway (a concurrent tx settled it). */
  | { kind: 'reverted'; txHash: Hex; nonceConsumed: boolean }
  /** Broadcast but no confirmed receipt within the timeout (or an RPC error while waiting). The tx MAY still confirm. */
  | { kind: 'broadcast-unconfirmed'; txHash: Hex; reason: 'timeout' | 'rpc-error' }
  /** Pre-submit: the nonce is already consumed on-chain — no tx was sent. */
  | { kind: 'nonce-already-used' }
  /** Pre-submit: payer balance < authorized value — no tx was sent. */
  | { kind: 'insufficient-balance'; haveBaseUnits: string; needBaseUnits: string }
  /** writeContract threw (or config missing) — NO tx was broadcast, so the nonce is NOT consumed. */
  | { kind: 'submit-error'; code: CircleNanoSettleErrorCode; reason: string }

/** Gas wallet account, or null if `SETTLEGRID_GAS_WALLET_KEY` is unset. */
function getGasWallet() {
  const rawKey = process.env.SETTLEGRID_GAS_WALLET_KEY
  if (!rawKey) return null
  const privateKey = rawKey.trim().replace(/^["']|["']$/g, '')
  return privateKeyToAccount(privateKey as `0x${string}`)
}

/**
 * The gas wallet's public address (read-only), or null if the key is unset.
 * Reuses {@link getGasWallet}'s key normalization so the B1.3 gas-balance
 * monitor reads the SAME address the settler signs from — without exposing the
 * signing account.
 */
export function getGasWalletAddress(): `0x${string}` | null {
  return getGasWallet()?.address ?? null
}

/** Split a 65-byte EIP-3009 signature into (v, r, s). The verifier already enforced canonical low-s, v∈{27,28}. */
function splitSignature(signature: string): { v: number; r: Hex; s: Hex } {
  const sig = signature.slice(2)
  const r = `0x${sig.slice(0, 64)}` as Hex
  const s = `0x${sig.slice(64, 128)}` as Hex
  const v = parseInt(sig.slice(128, 130), 16)
  return { v, r, s }
}

function publicClientFor(network: SupportedNetwork) {
  return createPublicClient({ chain: SUPPORTED_CHAINS[network], transport: http(getBaseRpcUrl(network)) })
}

/** (U) Reconciler-bounded twin of {@link publicClientFor}: same chain + URL resolution,
 * bounded transport. ADDITIVE — the live factory above is byte-identical (LB-1). */
function reconcilerPublicClientFor(network: SupportedNetwork) {
  return createPublicClient({
    chain: SUPPORTED_CHAINS[network],
    transport: http(getBaseRpcUrl(network), {
      timeout: RECONCILER_RPC_TIMEOUT_MS,
      retryCount: RECONCILER_RPC_RETRY_COUNT,
    }),
  })
}

/**
 * Submit a circle-nano EIP-3009 authorization on-chain, with pre-submit guards
 * and a confirmed-receipt wait. Pure mechanics — the caller owns ledger /
 * idempotency / locking. The verifier (`verifyCircleNanoAuthorization`) has
 * already proven the signature, payee, time-window, amount, and canonical sig.
 */
export async function submitCircleNanoOnChain(
  proof: Eip3009SettleProof,
  opts?: {
    /**
     * Invoked with the tx hash the instant the tx is broadcast, BEFORE the
     * receipt wait — so the caller can persist it and a mid-wait process kill
     * still leaves a re-waitable hash. Best-effort: a throw here does not abort
     * the receipt wait.
     */
    onBroadcast?: (txHash: Hex) => Promise<void>
  },
): Promise<CircleNanoOnChainResult> {
  const network = proof.network as SupportedNetwork
  const chain = SUPPORTED_CHAINS[network]
  const usdcAddress = USDC_ADDRESSES[proof.network]
  if (!chain || !usdcAddress) {
    return { kind: 'submit-error', code: 'UNSUPPORTED_NETWORK', reason: `Unsupported network: ${proof.network}.` }
  }

  const account = getGasWallet()
  if (!account) {
    return { kind: 'submit-error', code: 'GAS_WALLET_NOT_CONFIGURED', reason: 'SETTLEGRID_GAS_WALLET_KEY is not configured.' }
  }

  const { authorization } = proof
  const from = authorization.from as Address
  const nonce = authorization.nonce as Hex
  // Defense-in-depth: the offline verifier already proved these parse, but the
  // engine self-protects so a future caller wiring it without the verifier gets
  // a clean submit-error rather than an uncaught throw between guard and submit.
  let value: bigint
  let validAfter: bigint
  let validBefore: bigint
  try {
    value = BigInt(authorization.value)
    validAfter = BigInt(authorization.validAfter)
    validBefore = BigInt(authorization.validBefore)
  } catch {
    return { kind: 'submit-error', code: 'SETTLEMENT_RPC_ERROR', reason: 'authorization value/validAfter/validBefore are not integer strings.' }
  }
  const publicClient = publicClientFor(network)

  // Guard 1 — nonce not already consumed on-chain (avoids a guaranteed-revert
  // submit that burns gas). authorizationState is USDC's canonical (from,nonce)
  // idempotency oracle.
  let nonceUsed: boolean
  try {
    nonceUsed = (await publicClient.readContract({
      address: usdcAddress, abi: EIP3009_ABI, functionName: 'authorizationState', args: [from, nonce],
    })) as boolean
  } catch (err) {
    return { kind: 'submit-error', code: 'SETTLEMENT_RPC_ERROR', reason: `authorizationState read failed: ${(err as Error).message}` }
  }
  if (nonceUsed) return { kind: 'nonce-already-used' }

  // Guard 2 — payer balance covers the AUTHORIZED value (the full signed amount
  // that moves on-chain, which the verifier allows to be ≥ the tool cost).
  let balance: bigint
  try {
    balance = (await publicClient.readContract({
      address: usdcAddress, abi: EIP3009_ABI, functionName: 'balanceOf', args: [from],
    })) as bigint
  } catch (err) {
    return { kind: 'submit-error', code: 'SETTLEMENT_RPC_ERROR', reason: `balanceOf read failed: ${(err as Error).message}` }
  }
  if (balance < value) {
    return { kind: 'insufficient-balance', haveBaseUnits: balance.toString(), needBaseUnits: value.toString() }
  }

  // Submit.
  const walletClient = createWalletClient({ account, chain, transport: http(getBaseRpcUrl(network)) })
  const { v, r, s } = splitSignature(proof.signature)
  let txHash: Hex
  try {
    txHash = await walletClient.writeContract({
      address: usdcAddress,
      abi: EIP3009_ABI,
      functionName: 'transferWithAuthorization',
      args: [from, authorization.to as Address, value, validAfter, validBefore, nonce, v, r, s],
    })
  } catch (err) {
    const msg = (err as Error).message
    // writeContract threw ⇒ the tx was NOT accepted into the mempool ⇒ the
    // EIP-3009 nonce was NOT consumed ⇒ no money moved.
    const code: CircleNanoSettleErrorCode = /insufficient funds|gas required|exceeds .*balance/i.test(msg)
      ? 'GAS_WALLET_INSUFFICIENT'
      : 'SETTLEMENT_RPC_ERROR'
    return { kind: 'submit-error', code, reason: msg }
  }

  // Persist the broadcast hash BEFORE the receipt wait (write-ahead): if the
  // process is killed mid-wait, the caller still has a re-waitable tx and never
  // re-broadcasts a duplicate.
  if (opts?.onBroadcast) {
    try {
      await opts.onBroadcast(txHash)
    } catch {
      /* best-effort persistence; proceed to the receipt wait regardless */
    }
  }

  return interpretReceipt(publicClient, usdcAddress, from, nonce, txHash)
}

/**
 * Re-wait on an already-broadcast tx (timeout / crash recovery on a retry),
 * without re-submitting. Same confirmed-receipt semantics as a fresh submit.
 */
export async function confirmCircleNanoTx(
  proof: Eip3009SettleProof,
  txHash: Hex,
): Promise<CircleNanoOnChainResult> {
  const network = proof.network as SupportedNetwork
  const chain = SUPPORTED_CHAINS[network]
  const usdcAddress = USDC_ADDRESSES[proof.network]
  if (!chain || !usdcAddress) {
    return { kind: 'submit-error', code: 'UNSUPPORTED_NETWORK', reason: `Unsupported network: ${proof.network}.` }
  }
  const publicClient = publicClientFor(network)
  return interpretReceipt(
    publicClient,
    usdcAddress,
    proof.authorization.from as Address,
    proof.authorization.nonce as Hex,
    txHash,
  )
}

/** Result of an IMMEDIATE reconciliation receipt check (no wait). */
export type SettlementTxConfirmation =
  | { kind: 'settled'; txHash: Hex }
  /** Confirmed revert. `nonceConsumed` (circle-nano only): a concurrent tx spent the EIP-3009 nonce → NOT a failure. */
  | { kind: 'reverted'; txHash: Hex; nonceConsumed: boolean }
  /** Not mined yet / dropped / RPC error — leave the row 'pending' and retry next run.
   * (U) reason (optional, additive): 'revert-nonce-unverifiable' = a reverted receipt whose
   * nonce-state recheck failed — incomplete evidence deliberately NOT terminalized (LB-2). */
  | { kind: 'unconfirmed'; txHash: Hex; reason?: 'revert-nonce-unverifiable' }
  | { kind: 'unsupported-network' }

/**
 * Reconciler confirm for an ALREADY-broadcast settlement tx — an IMMEDIATE
 * receipt check (`getTransactionReceipt`, NOT `waitForTransactionReceipt`):
 * the tx was broadcast minutes ago, so we ask "is it mined NOW?" and never
 * block (so one stuck tx can't starve the rest of the batch).
 *
 * For circle-nano, pass `eip3009 = {from, nonce}` so a reverted tx triggers the
 * SAME audited authorizationState recheck `interpretReceipt` uses (a concurrent
 * tx may have spent the nonce → not a failure). x402 carries no nonce on this
 * path → omit `eip3009`, and a revert is a plain failure. Read-only.
 */
export async function confirmSettlementTx(
  network: string,
  txHash: Hex,
  eip3009?: { from: Address; nonce: Hex },
): Promise<SettlementTxConfirmation> {
  const chain = SUPPORTED_CHAINS[network as SupportedNetwork]
  const usdcAddress = USDC_ADDRESSES[network]
  if (!chain || !usdcAddress) return { kind: 'unsupported-network' }
  // (U) — the reconciler-bounded client: one degraded RPC call must never eat the run's
  // examination budget (viem defaults are ~41s worst per hung call; bounded = 6.15s).
  const publicClient = reconcilerPublicClientFor(network as SupportedNetwork)

  let receipt
  try {
    receipt = await publicClient.getTransactionReceipt({ hash: txHash })
  } catch {
    // Not mined yet / dropped / RPC error — cannot confirm now; leave pending.
    return { kind: 'unconfirmed', txHash }
  }
  if (receipt.status === 'success') return { kind: 'settled', txHash }

  // Reverted: THIS tx moved no funds. For circle-nano, recheck whether the nonce
  // is nonetheless consumed (a concurrent settler moved the USDC) — same logic
  // as interpretReceipt.
  let nonceConsumed = false
  if (eip3009) {
    try {
      nonceConsumed = (await publicClient.readContract({
        address: usdcAddress,
        abi: EIP3009_ABI,
        functionName: 'authorizationState',
        args: [eip3009.from, eip3009.nonce],
      })) as boolean
    } catch {
      // (U) LB-2 — the funds trap: a failed nonce-state read after a reverted receipt is
      // INCOMPLETE evidence. Defaulting nonceConsumed:false would let the reconciler
      // CAS-flip 'failed' while a concurrent winner may have moved the USDC (the (T) CAS
      // cannot protect — the ref matches). Safe direction: 'unconfirmed' — the row stays
      // pending and re-examines next rotation with fresh evidence. The no-eip3009 branch
      // is unaffected (no nonce exists to check; the receipt is complete evidence).
      return { kind: 'unconfirmed', txHash, reason: 'revert-nonce-unverifiable' }
    }
  }
  return { kind: 'reverted', txHash, nonceConsumed }
}

/** Shared receipt interpretation: success / reverted(+nonce recheck) / unconfirmed. */
async function interpretReceipt(
  publicClient: ReturnType<typeof publicClientFor>,
  usdcAddress: `0x${string}`,
  from: Address,
  nonce: Hex,
  txHash: Hex,
): Promise<CircleNanoOnChainResult> {
  try {
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1, timeout: RECEIPT_TIMEOUT_MS })
    if (receipt.status === 'success') return { kind: 'settled', txHash }
    // Reverted: THIS tx moved no USDC. If the nonce is nonetheless consumed, a
    // concurrent tx settled the authorization — surface that so the orchestrator
    // does NOT record a false 'failed'.
    let nonceConsumed = false
    try {
      nonceConsumed = (await publicClient.readContract({
        address: usdcAddress, abi: EIP3009_ABI, functionName: 'authorizationState', args: [from, nonce],
      })) as boolean
    } catch {
      /* leave false — orchestrator treats unknown as the failure side */
    }
    return { kind: 'reverted', txHash, nonceConsumed }
  } catch (err) {
    if (err instanceof WaitForTransactionReceiptTimeoutError) {
      return { kind: 'broadcast-unconfirmed', txHash, reason: 'timeout' }
    }
    return { kind: 'broadcast-unconfirmed', txHash, reason: 'rpc-error' }
  }
}
