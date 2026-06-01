/**
 * Circle Nanopayments — offline EIP-3009 verification engine (P5 kernel
 * dispatch, Tier 1).
 *
 * Circle Nano payments ride on an EIP-3009 `transferWithAuthorization`: the
 * payer signs an EIP-712 typed message authorizing a one-time USDC transfer
 * to a recipient. We verify that authorization **entirely offline** — recover
 * the signer from the EIP-712 signature and confirm it is the `from` address,
 * check the payee is SettleGrid, the time window is open, and the authorized
 * amount covers the tool's cost. No Circle account, API key, or RPC call is
 * required to verify (matching x402's `USDC_ADDRESSES` table for the contract
 * the signature is domain-bound to).
 *
 * What this verifier intentionally DOES NOT do (it stays OFFLINE by design):
 *   - submit the `transferWithAuthorization` on-chain;
 *   - check the EIP-3009 nonce hasn't already been consumed on-chain
 *     (`authorizationState`);
 *   - check the payer's on-chain USDC balance.
 * As of P3.K4 A2 these all run in the on-chain SETTLE path — the gas-wallet
 * submit + the pre-submit nonce/balance guards + the confirmed-receipt wait live
 * in lib/settlement/circle-nano/settle-engine.ts. This offline verifier is still
 * the fast, RPC-free gate used by /verify and the pre-submit re-verify on /settle.
 */

import { recoverTypedDataAddress, type Address, type Hex } from 'viem'
import { USDC_ADDRESSES } from '../x402/types'
import type { CircleNanoErrorCode } from '@settlegrid/mcp'
import type { Eip3009SettleProof } from '../eip3009/types'

/**
 * The EIP-712 domain identity of each supported USDC deployment — pinned from
 * the LIVE contracts' `name()`/`version()` (read on-chain 2026-05-29), NOT
 * assumed. The `name` is NOT constant across networks: Base mainnet USDC is
 * "USD Coin" but Base Sepolia USDC is "USDC". A signature is bound to this
 * exact tuple, so a wrong constant fails closed (verification rejects) rather
 * than mis-accepting. If a new network is added, read its USDC name/version
 * on-chain — do not assume "USD Coin"/"2".
 */
export const USDC_EIP712_DOMAINS: Record<
  string,
  { name: string; version: string; chainId: number }
> = {
  'eip155:8453': { name: 'USD Coin', version: '2', chainId: 8453 }, // Base mainnet
  'eip155:84532': { name: 'USDC', version: '2', chainId: 84532 }, // Base Sepolia
}

/**
 * The EIP-3009 `TransferWithAuthorization` typed-data struct. Field order and
 * types are normative (EIP-3009 / USDC FiatTokenV2) — they must match exactly
 * what the wallet signed or recovery yields a different address.
 */
const TRANSFER_WITH_AUTHORIZATION_TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

// secp256k1 group order; the low-s upper bound is N/2 (EIP-2). USDC's on-chain
// transferWithAuthorization (OpenZeppelin ECDSA) rejects high-s and v∉{27,28},
// so the offline verifier enforces the same canonical form — otherwise it
// could accept a signature the chain would reject (a verify/settle mismatch),
// and one authorization could carry up to 4 distinct byte-encodings that all
// recover to the payer (a malleability / dedup footgun).
const SECP256K1_N =
  0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n
const SECP256K1_HALF_N = SECP256K1_N / 2n

function checkCanonicalSignature(
  signature: string,
): { ok: true } | { ok: false; reason: string } {
  if (!/^0x[0-9a-fA-F]{130}$/.test(signature)) {
    return { ok: false, reason: 'Signature must be 65 bytes (0x + 130 hex chars).' }
  }
  // bytes: r = [0,32), s = [32,64), v = [64]  →  hex offsets after '0x'
  const s = BigInt('0x' + signature.slice(66, 130))
  if (s === 0n || s > SECP256K1_HALF_N) {
    return {
      ok: false,
      reason: 'Non-canonical signature: s is zero or high-s (malleable). Re-sign with low-s.',
    }
  }
  const v = parseInt(signature.slice(130, 132), 16)
  if (v !== 27 && v !== 28) {
    return { ok: false, reason: `Non-canonical signature: v must be 27 or 28, got ${v}.` }
  }
  return { ok: true }
}

export interface CircleNanoVerifyParams {
  /** The platform USDC address the authorization MUST pay (`authorization.to`). */
  recipient: string
  /** Tool cost expressed in USDC base units (6 decimals). */
  requiredBaseUnits: bigint
  /** Injectable clock (unix seconds) for deterministic tests. */
  now?: number
  /**
   * Amount policy. `false`/undefined (circle-nano default): the authorized
   * `value` need only be >= `requiredBaseUnits` (over-authorization tolerated).
   * `true` (x402 `exact` scheme): `value` must EQUAL `requiredBaseUnits` — the
   * canonical x402 V2 facilitator rejects `value !== amount` (ground-truthed
   * against coinbase/x402 `main`), and exact equality also removes any
   * over-collection of the payer.
   */
  exactAmount?: boolean
}

export interface CircleNanoVerifyResult {
  valid: boolean
  payerAddress?: string
  amountBaseUnits?: string
  errorCode?: CircleNanoErrorCode
  invalidReason?: string
}

/**
 * Verify an EIP-3009 authorization offline.
 *
 * Order is deliberate: cheap structural/policy checks (network, payee, time,
 * amount) first for precise error codes, then the authoritative cryptographic
 * gate (signature recovery) last. A caller cannot reach `valid: true` without
 * a signature that recovers to `authorization.from` over the exact fields
 * checked, so the structural checks can't be spoofed past the crypto gate.
 */
export async function verifyEip3009Authorization(
  proof: Eip3009SettleProof,
  params: CircleNanoVerifyParams,
): Promise<CircleNanoVerifyResult> {
  const { recipient, requiredBaseUnits } = params
  const nowSec = BigInt(params.now ?? Math.floor(Date.now() / 1000))
  const { network, authorization, signature } = proof

  const domain = USDC_EIP712_DOMAINS[network]
  const verifyingContract = USDC_ADDRESSES[network]
  if (!domain || !verifyingContract) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_NETWORK_UNSUPPORTED',
      invalidReason: `Unsupported network: ${network}. Supported: ${Object.keys(USDC_EIP712_DOMAINS).join(', ')}.`,
    }
  }

  // Payee must be SettleGrid. Without this, any valid EIP-3009 signature
  // (e.g. one paying a third party) would otherwise pass the crypto gate.
  if (authorization.to.toLowerCase() !== recipient.toLowerCase()) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_WRONG_RECIPIENT',
      invalidReason: `Authorization pays ${authorization.to}, not the SettleGrid recipient.`,
    }
  }

  // Parse the three uint256 fields once, strictly (BigInt rejects decimals,
  // hex-with-suffix, and non-numeric input by throwing).
  let value: bigint
  let validAfter: bigint
  let validBefore: bigint
  try {
    value = BigInt(authorization.value)
    validAfter = BigInt(authorization.validAfter)
    validBefore = BigInt(authorization.validBefore)
  } catch {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_AUTH_INVALID',
      invalidReason: 'value / validAfter / validBefore must be integer (base-unit / unix-second) strings.',
    }
  }

  if (nowSec < validAfter) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_NOT_YET_VALID',
      invalidReason: `Authorization not yet valid: becomes valid in ${validAfter - nowSec}s.`,
    }
  }
  if (nowSec > validBefore) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_EXPIRED',
      invalidReason: `Authorization expired ${nowSec - validBefore}s ago.`,
    }
  }

  const amountOk = params.exactAmount ? value === requiredBaseUnits : value >= requiredBaseUnits
  if (!amountOk) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_AMOUNT_MISMATCH',
      invalidReason: params.exactAmount
        ? `Authorization value ${value} must EXACTLY equal the required ${requiredBaseUnits} USDC base units (x402 exact scheme).`
        : `Authorization covers ${value} USDC base units but tool requires ${requiredBaseUnits}.`,
    }
  }

  // Reject non-canonical (malleable) signatures BEFORE recovery so the offline
  // verdict matches what USDC's on-chain ECDSA would accept.
  const canon = checkCanonicalSignature(signature)
  if (!canon.ok) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_AUTH_INVALID',
      invalidReason: canon.reason,
    }
  }

  // Authoritative gate: recover the EOA that signed this exact EIP-712
  // message and confirm it is the claimed payer. Offline (no RPC) — viem
  // recoverTypedDataAddress is pure secp256k1/keccak recovery.
  let recovered: Address
  try {
    recovered = await recoverTypedDataAddress({
      domain: {
        name: domain.name,
        version: domain.version,
        chainId: domain.chainId,
        verifyingContract: verifyingContract as Address,
      },
      types: TRANSFER_WITH_AUTHORIZATION_TYPES,
      primaryType: 'TransferWithAuthorization',
      message: {
        from: authorization.from as Address,
        to: authorization.to as Address,
        value,
        validAfter,
        validBefore,
        nonce: authorization.nonce as Hex,
      },
      signature: signature as Hex,
    })
  } catch {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_AUTH_INVALID',
      invalidReason: 'EIP-712 signature is malformed or could not be recovered.',
    }
  }

  if (recovered.toLowerCase() !== authorization.from.toLowerCase()) {
    return {
      valid: false,
      errorCode: 'CIRCLE_NANO_AUTH_INVALID',
      invalidReason: `EIP-712 signature recovered to ${recovered}, not the payer ${authorization.from}.`,
    }
  }

  return {
    valid: true,
    payerAddress: authorization.from,
    amountBaseUnits: value.toString(),
  }
}

/**
 * Back-compat alias. This offline EIP-3009 verifier is RAIL-AGNOSTIC — it is the
 * single audited recover-and-policy-check used by BOTH circle-nano (default:
 * `value >= required`) and the x402 exact-scheme settlement orchestrator
 * (`exactAmount: true` → `value === required`). It lives under `circle-nano/`
 * for historical reasons; circle-nano callers + their tests import this name.
 */
export { verifyEip3009Authorization as verifyCircleNanoAuthorization }
