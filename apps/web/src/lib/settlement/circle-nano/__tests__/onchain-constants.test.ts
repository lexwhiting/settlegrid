/**
 * P3.K4 A2 — ground-truth REGRESSION GUARD for the circle-nano on-chain constants.
 *
 * Because A2 moves real money, the USDC addresses + the EIP-712 domain the
 * verifier binds signatures to were read from the LIVE Base mainnet + Base
 * Sepolia contracts on 2026-05-30 (a throwaway viem script against a public RPC).
 * The decisive check below recomputes each EIP-712 domain separator from the
 * verifier's pinned {name, version, chainId, verifyingContract} and asserts it is
 * byte-identical to the contract's on-chain DOMAIN_SEPARATOR() captured then.
 *
 * This is EXACTLY the check that would have caught the prior Base-Sepolia bug
 * (name "USDC" vs "USD Coin"): every offline test + the gold test missed it
 * because they shared the same hardcoded constant — only reading the live
 * contract caught it. If anyone edits USDC_ADDRESSES or USDC_EIP712_DOMAINS, the
 * recomputed separator diverges from the live snapshot and this test fails,
 * forcing a conscious re-ground-truth against the live contracts.
 */
import { describe, it, expect } from 'vitest'
import { keccak256, toBytes, encodeAbiParameters } from 'viem'
import { USDC_ADDRESSES } from '../../x402/types'
import { USDC_EIP712_DOMAINS } from '../verify'

/** Live-contract snapshot read 2026-05-30 (Base mainnet 8453 + Base Sepolia 84532). */
const LIVE = {
  'eip155:8453': {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    domainSeparator: '0x02fa7265e7c5d81118673727957699e4d68f74cd74b7db77da710fe8a2c7834f',
  },
  'eip155:84532': {
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    domainSeparator: '0x71f17a3b2ff373b803d70a5a07c046c1a2bc8e89c09ef722fcb047abe94c9818',
  },
} as const

const DOMAIN_TYPEHASH = keccak256(
  toBytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)'),
)

function computeDomainSeparator(name: string, version: string, chainId: number, verifyingContract: `0x${string}`) {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
      [DOMAIN_TYPEHASH, keccak256(toBytes(name)), keccak256(toBytes(version)), BigInt(chainId), verifyingContract],
    ),
  )
}

describe.each(Object.keys(LIVE) as Array<keyof typeof LIVE>)(
  'circle-nano on-chain constants — %s (ground-truthed 2026-05-30)',
  (network) => {
    it('USDC address matches the live deployment', () => {
      expect(USDC_ADDRESSES[network].toLowerCase()).toBe(LIVE[network].usdc.toLowerCase())
    })

    it('pinned EIP-712 domain reproduces the live DOMAIN_SEPARATOR (byte-identical)', () => {
      const d = USDC_EIP712_DOMAINS[network]
      expect(d).toBeDefined()
      const computed = computeDomainSeparator(d.name, d.version, d.chainId, USDC_ADDRESSES[network])
      expect(computed).toBe(LIVE[network].domainSeparator)
    })
  },
)
