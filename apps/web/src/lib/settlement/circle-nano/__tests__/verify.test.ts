/**
 * Gold test for the Circle Nano OFFLINE EIP-3009 verifier.
 *
 * The linchpin: we sign a TransferWithAuthorization with viem using the REAL
 * USDC EIP-712 domain (name "USD Coin", version "2", Base chainId 8453, USDC
 * verifyingContract) — i.e. exactly how a real agent wallet signs — and assert
 * verifyCircleNanoAuthorization recovers the signer and accepts it. Because
 * the signing domain here IS the production USDC domain, a pass proves real
 * USDC authorizations verify (not just an internally-consistent round-trip).
 * Then we assert every rejection path: tampered signature, post-sign field
 * tamper, wrong payee, expired, not-yet-valid, underpaid, unsupported network.
 */
import { describe, it, expect } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { keccak256, encodeAbiParameters, stringToHex } from 'viem'
import type { CircleNanoProof } from '@settlegrid/mcp'
import { verifyCircleNanoAuthorization } from '../verify'

// Anvil/hardhat test account #0 — deterministic, well-known, NOT a real key.
const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_PK)
const PAYER = account.address // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

const RECIPIENT = '0x1111111111111111111111111111111111111111'

// The production USDC EIP-712 domains, per network, AS DEPLOYED on-chain
// (name()/version() read 2026-05-29). The `name` differs by network — Base
// mainnet is "USD Coin", Base Sepolia is "USDC" — which is exactly the kind of
// per-network mismatch this gold test exists to lock down. A real agent wallet
// signs against these, so signing here with them proves real authorizations
// verify (and the Sepolia case is a regression guard for that earlier bug).
const DOMAINS: Record<
  string,
  { name: string; version: string; chainId: number; verifyingContract: `0x${string}` }
> = {
  'eip155:8453': {
    name: 'USD Coin',
    version: '2',
    chainId: 8453,
    verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  },
  'eip155:84532': {
    name: 'USDC',
    version: '2',
    chainId: 84532,
    verifyingContract: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
}

const TYPES = {
  TransferWithAuthorization: [
    { name: 'from', type: 'address' },
    { name: 'to', type: 'address' },
    { name: 'value', type: 'uint256' },
    { name: 'validAfter', type: 'uint256' },
    { name: 'validBefore', type: 'uint256' },
    { name: 'nonce', type: 'bytes32' },
  ],
} as const

interface AuthFields {
  to: string
  value: string
  validAfter: string
  validBefore: string
  nonce: `0x${string}`
}

const DEFAULT_AUTH: AuthFields = {
  to: RECIPIENT,
  value: '10000', // 1 cent in USDC base units
  validAfter: '0',
  validBefore: '2000000000', // far future
  nonce: `0x${'11'.repeat(32)}`,
}

/** Build + sign a proof over the given fields with the real USDC domain. */
async function signedProof(
  overrides: Partial<AuthFields> = {},
  network = 'eip155:8453',
): Promise<CircleNanoProof> {
  const fields = { ...DEFAULT_AUTH, ...overrides }
  const authorization = { from: PAYER, ...fields }
  const signature = await account.signTypedData({
    domain: DOMAINS[network] ?? DOMAINS['eip155:8453'],
    types: TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: PAYER as `0x${string}`,
      to: fields.to as `0x${string}`,
      value: BigInt(fields.value),
      validAfter: BigInt(fields.validAfter),
      validBefore: BigInt(fields.validBefore),
      nonce: fields.nonce,
    },
  })
  return { network, authorization, signature }
}

// now=1000 is inside [validAfter=0, validBefore=2e9]; require exactly 1 cent.
const PARAMS = { recipient: RECIPIENT, requiredBaseUnits: 10000n, now: 1000 }

describe('verifyCircleNanoAuthorization — accepts a genuine signature', () => {
  it('accepts a valid EIP-3009 authorization signed with the real USDC domain', async () => {
    const proof = await signedProof()
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(true)
    expect(result.payerAddress?.toLowerCase()).toBe(PAYER.toLowerCase())
    expect(result.amountBaseUnits).toBe('10000')
  })

  it('accepts an over-payment (authorized amount above the required cost)', async () => {
    const proof = await signedProof({ value: '50000' })
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(true)
  })

  it('accepts a valid authorization on Base Sepolia (domain name is "USDC", not "USD Coin")', async () => {
    // Regression guard: the verifier must use the PER-NETWORK domain name.
    // Signed with Base Sepolia's real domain (name "USDC", chainId 84532);
    // this fails if the verifier assumes "USD Coin" everywhere.
    const proof = await signedProof({}, 'eip155:84532')
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(true)
    expect(result.payerAddress?.toLowerCase()).toBe(PAYER.toLowerCase())
  })
})

describe('verifyCircleNanoAuthorization — rejects every tampering / policy failure', () => {
  it('rejects a tampered signature (flipped last byte)', async () => {
    const proof = await signedProof()
    const last = proof.signature.slice(-2)
    proof.signature = (proof.signature.slice(0, -2) +
      (last === '00' ? '01' : '00')) as `0x${string}`
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('rejects a value tampered AFTER signing (signature no longer recovers to payer)', async () => {
    const proof = await signedProof()
    // Raise the value above the requirement so it passes the amount check
    // and is caught specifically by signature recovery.
    proof.authorization.value = '999999999'
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('rejects when the payee is not the SettleGrid recipient', async () => {
    // Signed correctly, but to a different address than PARAMS.recipient.
    const proof = await signedProof({ to: '0x2222222222222222222222222222222222222222' })
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_WRONG_RECIPIENT')
  })

  it('rejects an expired authorization', async () => {
    const proof = await signedProof({ validBefore: '500' })
    const result = await verifyCircleNanoAuthorization(proof, { ...PARAMS, now: 1000 })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_EXPIRED')
  })

  it('rejects a not-yet-valid authorization', async () => {
    const proof = await signedProof({ validAfter: '5000' })
    const result = await verifyCircleNanoAuthorization(proof, { ...PARAMS, now: 1000 })
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_NOT_YET_VALID')
  })

  it('rejects an under-payment', async () => {
    const proof = await signedProof({ value: '5000' }) // < 10000 required
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AMOUNT_MISMATCH')
  })

  it('rejects an unsupported network (Base-only rail; ETH mainnet not accepted)', async () => {
    const proof = await signedProof({}, 'eip155:1')
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_NETWORK_UNSUPPORTED')
  })

  it('rejects non-integer numeric fields without throwing', async () => {
    const proof = await signedProof()
    proof.authorization.value = '12.5'
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
  })
})

describe('verifyCircleNanoAuthorization — crypto edge cases (canonical sig + domain isolation)', () => {
  const SECP256K1_N =
    0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n

  it('REJECTS a malleated (high-s) signature — matches USDC on-chain ECDSA', async () => {
    const proof = await signedProof() // viem signs canonical (low-s, v∈{27,28})
    expect((await verifyCircleNanoAuthorization(proof, PARAMS)).valid).toBe(true)
    // Malleate: s' = N - s, flip v. A naive ecrecover yields the SAME payer,
    // but the verifier must reject it as non-canonical (high-s) — exactly as
    // USDC's on-chain OZ-ECDSA would.
    const sig = proof.signature
    const r = sig.slice(2, 66)
    const s = BigInt('0x' + sig.slice(66, 130))
    const v = parseInt(sig.slice(130, 132), 16)
    const sMal = (SECP256K1_N - s).toString(16).padStart(64, '0')
    const vMal = (v === 27 ? 28 : 27).toString(16).padStart(2, '0')
    proof.signature = `0x${r}${sMal}${vMal}` as `0x${string}`
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
    expect(result.invalidReason).toMatch(/high-s|canonical/i)
  })

  it('REJECTS a signature with v ∈ {0,1} (non-canonical v)', async () => {
    const proof = await signedProof()
    proof.signature = (proof.signature.slice(0, 130) + '00') as `0x${string}` // v=0
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
    expect(result.invalidReason).toMatch(/v must be 27 or 28/i)
  })

  it('REJECTS an EIP-2098 compact (64-byte) signature', async () => {
    const proof = await signedProof()
    proof.signature = proof.signature.slice(0, 130) as `0x${string}` // drop the v byte
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('REJECTS a Base Sepolia-signed authorization presented as Base mainnet (domain isolation)', async () => {
    const proof = await signedProof({}, 'eip155:84532') // signed for Sepolia's domain
    proof.network = 'eip155:8453' // ...but presented as mainnet → wrong domain → recovery mismatch
    const result = await verifyCircleNanoAuthorization(proof, PARAMS)
    expect(result.valid).toBe(false)
    expect(result.errorCode).toBe('CIRCLE_NANO_AUTH_INVALID')
  })

  it('offline EIP-712 domain separator == the live on-chain DOMAIN_SEPARATOR (both networks)', () => {
    // On-chain DOMAIN_SEPARATOR() read from the deployed USDC contracts
    // (2026-05-29). Pinning these makes any future domain edit that silently
    // diverges from chain fail in CI.
    const EXPECTED: Record<string, string> = {
      'eip155:8453': '0x02fa7265e7c5d81118673727957699e4d68f74cd74b7db77da710fe8a2c7834f',
      'eip155:84532': '0x71f17a3b2ff373b803d70a5a07c046c1a2bc8e89c09ef722fcb047abe94c9818',
    }
    const TYPEHASH = keccak256(
      stringToHex(
        'EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)',
      ),
    )
    for (const [network, d] of Object.entries(DOMAINS)) {
      const separator = keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'bytes32' }, { type: 'bytes32' }, { type: 'uint256' }, { type: 'address' }],
          [
            TYPEHASH,
            keccak256(stringToHex(d.name)),
            keccak256(stringToHex(d.version)),
            BigInt(d.chainId),
            d.verifyingContract,
          ],
        ),
      )
      expect(separator).toBe(EXPECTED[network])
    }
  })
})
