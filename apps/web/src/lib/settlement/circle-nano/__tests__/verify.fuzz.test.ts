/**
 * Fuzz / property test for the Circle Nano parser + offline verifier.
 *
 * Two invariants, hammered with random + adversarial input:
 *   (P1) parseCircleNanoProof + verifyCircleNanoAuthorization NEVER throw
 *        (every defect must surface as a clean null / valid:false).
 *   (P2) NEVER wrong-accept: no random input, and no single-mutation of a
 *        genuinely-signed proof, ever yields valid:true.
 *
 * Deterministic (seeded mulberry32) so any failure is reproducible.
 */
import { describe, it, expect } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import { parseCircleNanoProof, type CircleNanoProof } from '@settlegrid/mcp'
import { verifyCircleNanoAuthorization } from '../verify'

// -- seeded PRNG --------------------------------------------------------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xc1c1e0a0)
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)]
function randString(maxLen = 64): string {
  const charsets = [
    'abcdef0123456789',
    '{}[]":,. \n\t',
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',
    '0xabcdefABCDEF',
    '"\\{}[]<>|~`!@#$%^&*()-_=+;:.,?',
  ]
  const cs = pick(charsets)
  const len = Math.floor(rand() * maxLen)
  let s = ''
  for (let i = 0; i < len; i++) s += cs[Math.floor(rand() * cs.length)]
  return s
}

const account = privateKeyToAccount(
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
)
const RECIPIENT = '0x1111111111111111111111111111111111111111'
const PARAMS = { recipient: RECIPIENT, requiredBaseUnits: 10000n, now: 1000 }
const DOMAIN = {
  name: 'USD Coin',
  version: '2',
  chainId: 8453,
  verifyingContract: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as `0x${string}`,
} as const
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

async function validSignedProof(): Promise<CircleNanoProof> {
  const authorization = {
    from: account.address,
    to: RECIPIENT,
    value: '10000',
    validAfter: '0',
    validBefore: '2000000000',
    nonce: `0x${'11'.repeat(32)}`,
  }
  const signature = await account.signTypedData({
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'TransferWithAuthorization',
    message: {
      from: authorization.from as `0x${string}`,
      to: authorization.to as `0x${string}`,
      value: BigInt(authorization.value),
      validAfter: BigInt(authorization.validAfter),
      validBefore: BigInt(authorization.validBefore),
      nonce: authorization.nonce as `0x${string}`,
    },
  })
  return { network: 'eip155:8453', authorization, signature }
}

describe('fuzz: parseCircleNanoProof + verifyCircleNanoAuthorization never throw / never wrong-accept', () => {
  it('P1/P2: random strings and random envelopes are handled cleanly and never accepted', async () => {
    const NETWORKS = ['eip155:8453', 'eip155:84532', 'eip155:1', 'solana:x', '', randString(8)]
    for (let i = 0; i < 1500; i++) {
      // (a) raw random string straight into the parser
      const raw = randString(80)
      let parsed: CircleNanoProof | null = null
      expect(() => {
        parsed = parseCircleNanoProof(raw)
      }).not.toThrow()
      if (parsed) {
        const r = await verifyCircleNanoAuthorization(parsed, PARAMS)
        expect(r.valid).toBe(false) // a random string can't carry a valid sig
      }

      // (b) a structurally-shaped but randomized envelope (base64 JSON)
      const envelope = {
        network: pick(NETWORKS),
        signature: pick(['0x' + randString(130), randString(40), '', '0x']),
        authorization: {
          from: pick([account.address, '0x' + randString(40), RECIPIENT, '', 'not-an-address']),
          to: pick([RECIPIENT, account.address, '0x' + randString(40), '']),
          value: pick(['10000', '5000', '-1', '12.5', '0x10', '', randString(6), '99999999999999999999999999']),
          validAfter: pick(['0', '5000', '-1', 'abc', '', '9999999999']),
          validBefore: pick(['2000000000', '500', '-1', '', 'xyz']),
          nonce: pick([`0x${'11'.repeat(32)}`, '0x12', randString(20), '']),
        },
      }
      const encoded = Buffer.from(JSON.stringify(envelope)).toString('base64')
      let parsed2: CircleNanoProof | null = null
      expect(() => {
        parsed2 = parseCircleNanoProof(encoded)
      }).not.toThrow()
      if (parsed2) {
        let result: Awaited<ReturnType<typeof verifyCircleNanoAuthorization>> | undefined
        await expect(
          (async () => {
            result = await verifyCircleNanoAuthorization(parsed2!, PARAMS)
          })(),
        ).resolves.not.toThrow()
        // No randomized envelope can produce a signature that recovers to its
        // own `from` over these exact fields, so it must never be accepted.
        expect(result!.valid).toBe(false)
      }
    }
  })

  it('P2: single-field mutations of a genuinely-signed proof are never accepted', async () => {
    const base = await validSignedProof()
    // sanity: the un-mutated proof IS accepted
    expect((await verifyCircleNanoAuthorization(base, PARAMS)).valid).toBe(true)

    const fields = ['from', 'to', 'value', 'validAfter', 'validBefore', 'nonce'] as const
    for (let i = 0; i < 300; i++) {
      const clone: CircleNanoProof = {
        network: base.network,
        signature: base.signature,
        authorization: { ...base.authorization },
      }
      const mode = Math.floor(rand() * 3)
      if (mode === 0) {
        // mutate a signed authorization field
        const f = pick([...fields])
        clone.authorization[f] = pick([
          '0x' + randString(40),
          String(Math.floor(rand() * 1e9)),
          RECIPIENT,
          account.address,
          `0x${'22'.repeat(32)}`,
        ])
      } else if (mode === 1) {
        // flip a byte in the signature
        const sig = base.signature
        const idx = 2 + Math.floor(rand() * (sig.length - 2))
        const ch = sig[idx]
        clone.signature = (sig.slice(0, idx) +
          (ch === '0' ? '1' : '0') +
          sig.slice(idx + 1)) as `0x${string}`
      } else {
        // mutate the network
        clone.network = pick(['eip155:84532', 'eip155:1', 'solana:x', ''])
      }

      // Skip the rare no-op mutation (a field re-assigned its current value);
      // we only assert the never-accept property on genuine changes.
      const changed =
        clone.network !== base.network ||
        clone.signature !== base.signature ||
        fields.some((f) => clone.authorization[f] !== base.authorization[f])
      if (!changed) continue

      let result: Awaited<ReturnType<typeof verifyCircleNanoAuthorization>> | undefined
      await expect(
        (async () => {
          result = await verifyCircleNanoAuthorization(clone, PARAMS)
        })(),
      ).resolves.not.toThrow()
      // Every signed field (and the network) is bound by the recovery; a
      // mutation must drop it to invalid. (network swap to 84532 changes the
      // domain → recovery mismatch; the rest break the message or a policy gate.)
      expect(result!.valid).toBe(false)
    }
  })
})
