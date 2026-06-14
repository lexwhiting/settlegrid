/**
 * B1.1 — circle-nano 402 payment-discovery gold test.
 *
 * The live circle-nano rail's verifier requires `authorization.to ===
 * SETTLEGRID_USDC_RECIPIENT`, but before B1.1 the 402 challenge never told a
 * payer that recipient (nor the USDC contract / EIP-712 domain) — so an
 * external payer could not construct a valid authorization. B1.1 makes the 402
 * self-describing.
 *
 * The linchpin test (`closes the discovery loop`) does NOT trust hand-written
 * constants: it generates the real wrapper 402, extracts ONLY the advertised
 * fields (pay_to, asset_address, eip712_domain, amount), signs a
 * TransferWithAuthorization with exactly those, and asserts the production
 * verifier accepts it. Because the 402's domain is sourced from the SAME
 * `USDC_EIP712_DOMAINS` constant the verifier binds to, a pass proves
 * "advertised == verified" by construction (operationally, not just by
 * assertion): a payer who follows the 402 always matches the verifier. Note
 * this is a CONSISTENCY guarantee — a wrong-but-consistent constant would move
 * both sides together and still pass here. That the pinned constant matches the
 * LIVE on-chain USDC domain (the actual A2 "USDC" vs "USD Coin" bug class) is
 * guarded separately by onchain-constants.test.ts (which recomputes the live
 * DOMAIN_SEPARATOR) plus a manual re-ground-truth read against the live chain.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { privateKeyToAccount } from 'viem/accounts'
import type { CircleNanoProof } from '@settlegrid/mcp'
import { generateCircleNano402Response } from '@/lib/circle-nano-proxy'
import { getCircleNanoRecipient } from '@/lib/env'
import { verifyCircleNanoAuthorization, USDC_EIP712_DOMAINS } from '@/lib/settlement/circle-nano/verify'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'

// Anvil/hardhat test account #0 — deterministic, well-known, NOT a real key.
const TEST_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const account = privateKeyToAccount(TEST_PK)
const PAYER = account.address // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

// A valid (test) recipient address — modelling SETTLEGRID_USDC_RECIPIENT in prod.
const TEST_RECIPIENT = '0x0859cF704798619133241A385220D6797C635c95'
const NETWORK = 'eip155:8453' // the rail's advertised + settled network (Base mainnet)

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

async function read402Body(costCents = 5): Promise<Record<string, unknown>> {
  const res = generateCircleNano402Response('my-tool', costCents, 'My Tool')
  expect(res.status).toBe(402)
  return (await res.json()) as Record<string, unknown>
}

beforeEach(() => {
  vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', TEST_RECIPIENT)
  vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://settlegrid.ai')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('B1.1 — circle-nano 402 surfaces ground-truthed discovery fields', () => {
  it('advertises pay_to + asset_address + eip712_domain from the pinned constants the verifier binds to', async () => {
    const body = await read402Body()
    const settlement = body.settlement as Record<string, unknown>

    // pay_to is the live recipient the verifier requires as authorization.to.
    expect(body.pay_to).toBe(TEST_RECIPIENT)
    expect(body.pay_to).toBe(getCircleNanoRecipient())

    // asset_address is the USDC contract for the advertised network.
    expect(settlement.network).toBe(NETWORK)
    expect(settlement.asset_address).toBe(USDC_ADDRESSES[NETWORK])

    // The advertised EIP-712 domain is byte-equal to the verifier's own pinned
    // domain (advertised == verified BY CONSTRUCTION — single source of truth).
    const pinned = USDC_EIP712_DOMAINS[NETWORK]
    expect(settlement.eip712_domain).toEqual({
      name: pinned.name,
      version: pinned.version,
      chain_id: pinned.chainId,
      verifying_contract: USDC_ADDRESSES[NETWORK],
    })

    // verifying_contract MUST equal asset_address (same source — cannot drift).
    const domain = settlement.eip712_domain as Record<string, unknown>
    expect(domain.verifying_contract).toBe(settlement.asset_address)

    // network (CAIP-2 `eip155:<id>`) and the domain's chain_id must be coherent:
    // the payer signs the EIP-712 domain with chain_id, so a mismatch with the
    // advertised settlement network would bind the signature to the wrong chain.
    expect(Number((settlement.network as string).split(':')[1])).toBe(domain.chain_id)
  })

  it('closes the discovery loop: an authorization built from ONLY the 402 fields verifies', async () => {
    const body = await read402Body(5)
    const settlement = body.settlement as Record<string, unknown>
    const advertisedDomain = settlement.eip712_domain as {
      name: string
      version: string
      chain_id: number
      verifying_contract: `0x${string}`
    }

    // A payer reads the 402 and uses ONLY what it advertises — nothing else.
    const to = body.pay_to as `0x${string}`
    const value = BigInt(body.amount_usdc_base_units as string)
    const validAfter = 0n
    // Within the V-N1 cap relative to now:1000 below (cap = now + 3600 = 4600).
    const validBefore = 1_300n
    const nonce = `0x${'22'.repeat(32)}` as `0x${string}`

    const signature = await account.signTypedData({
      domain: {
        name: advertisedDomain.name,
        version: advertisedDomain.version,
        chainId: advertisedDomain.chain_id,
        verifyingContract: advertisedDomain.verifying_contract,
      },
      types: TYPES,
      primaryType: 'TransferWithAuthorization',
      message: { from: PAYER, to, value, validAfter, validBefore, nonce },
    })

    const proof: CircleNanoProof = {
      network: NETWORK,
      authorization: {
        from: PAYER,
        to,
        value: value.toString(),
        validAfter: validAfter.toString(),
        validBefore: validBefore.toString(),
        nonce,
      },
      signature,
    }

    // The verifier is invoked exactly as production does: recipient ===
    // getCircleNanoRecipient() (the same value the 402 advertised as pay_to).
    const result = await verifyCircleNanoAuthorization(proof, {
      recipient: getCircleNanoRecipient() as string,
      requiredBaseUnits: value,
      now: 1000,
    })

    expect(result.valid).toBe(true)
    expect(result.payerAddress?.toLowerCase()).toBe(PAYER.toLowerCase())
    expect(result.amountBaseUnits).toBe(value.toString())
  })

  it('instructions name the advertised payee + token so a payer can follow them directly', async () => {
    const body = await read402Body()
    const settlement = body.settlement as Record<string, unknown>
    expect(String(body.instructions)).toContain(body.pay_to as string)
    expect(String(body.instructions)).toContain(settlement.asset_address as string)
  })

  it('tolerates a recipient env with surrounding whitespace (trimmed before advertising)', async () => {
    // A stray trailing newline is a known env hazard for this deployment; the
    // getter trims it, so the 402 still advertises the clean checksummed address
    // (and the verifier — which reads the same getter — stays consistent).
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', `  ${TEST_RECIPIENT}\n`)
    expect(getCircleNanoRecipient()).toBe(TEST_RECIPIENT)
    const body = await read402Body()
    expect(body.pay_to).toBe(TEST_RECIPIENT)
  })
})

describe('B1.1 — circle-nano 402 advertises nothing it cannot honor', () => {
  it('omits pay_to + asset_address + eip712_domain when the recipient env is unset (dark rail)', async () => {
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '')
    const body = await read402Body()
    const settlement = body.settlement as Record<string, unknown>
    expect(body.pay_to).toBeUndefined()
    expect(settlement.asset_address).toBeUndefined()
    expect(settlement.eip712_domain).toBeUndefined()
    // The fallback instructions must not name a 0x payee/contract.
    expect(String(body.instructions)).not.toMatch(/0x[0-9a-fA-F]{40}/)
  })

  it('omits discovery when the recipient env is set but not a valid address (fail closed)', async () => {
    vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', 'not-an-address')
    const body = await read402Body()
    const settlement = body.settlement as Record<string, unknown>
    expect(body.pay_to).toBeUndefined()
    expect(settlement.asset_address).toBeUndefined()
    expect(settlement.eip712_domain).toBeUndefined()
  })
})
