/**
 * Shared shape for an EIP-3009 `transferWithAuthorization` settlement proof —
 * rail-agnostic. Both circle-nano (`CircleNanoProof` from @settlegrid/mcp) and
 * x402-exact (`X402ExactPayload.payload` + the top-level network) are
 * structurally THIS shape: the same 9 signed fields, the same USDC contracts,
 * the same chains, the same gas wallet. The on-chain settle engine
 * (`circle-nano/settle-engine.ts`) and the offline verifier
 * (`circle-nano/verify.ts`) are keyed off this so the audited EIP-3009
 * mechanics are written ONCE and reused by both rails — no crypto-logic
 * duplication (the exact drift class that shipped the A2 Base-Sepolia
 * domain-name bug).
 *
 * All fields are decimal/hex STRINGS as they arrive on the wire; the engine and
 * verifier parse + cast them (BigInt / Address / Hex) internally.
 */
export interface Eip3009SettleProof {
  /** CAIP-2 network id, e.g. 'eip155:8453'. */
  network: string
  authorization: {
    /** Payer EOA (0x address). */
    from: string
    /** Payee — the verifier binds this to the platform recipient. */
    to: string
    /** Authorized amount in USDC base units (6 decimals), as a decimal string. */
    value: string
    /** Unix-seconds lower bound, as a decimal string. */
    validAfter: string
    /** Unix-seconds upper bound, as a decimal string. */
    validBefore: string
    /** 0x-prefixed bytes32 EIP-3009 nonce. */
    nonce: string
  }
  /** 0x-prefixed 65-byte EIP-712 signature over the authorization. */
  signature: string
}
