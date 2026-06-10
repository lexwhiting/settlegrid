/**
 * (G) No-drift invariant for the x402 network allowlists (DC-07 guard).
 *
 * The four network sets live in different modules and historically diverged
 * (USDC_ADDRESSES grew eip155:1 while the confirm engine stayed Base-only —
 * the B1.4 carried debt). These pins make any future divergence a RED suite,
 * not a silent advertise-but-can't-confirm gap:
 *
 *   PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL == keys(SUPPORTED_CHAINS) ⊆ keys(USDC_ADDRESSES)
 *
 * SUPPORTED_CHAINS is the reconciler's confirm engine set AND the circle-nano
 * broadcast set; settle.ts getWalletClient is not enumerable (a switch) and is
 * pinned transitively by equality with SUPPORTED_CHAINS plus the route-level
 * pass-through tests in x402.test.ts.
 */
import { describe, it, expect } from 'vitest'
import {
  CANONICAL_X402_NETWORKS,
  isCanonicalX402Network,
} from '@/lib/settlement/x402/networks'
import { USDC_ADDRESSES } from '@/lib/settlement/x402/types'
import { SUPPORTED_CHAINS } from '@/lib/settlement/circle-nano/settle-engine'
import { PUBLIC_FACILITATOR_NETWORKS } from '@/app/api/x402/facilitator/v1/_shared'

describe('(G) canonical x402 network allowlist — no-drift invariant', () => {
  it('CANONICAL == keys(SUPPORTED_CHAINS) — settleable+confirmable IS the engine set', () => {
    expect([...CANONICAL_X402_NETWORKS].sort()).toEqual(Object.keys(SUPPORTED_CHAINS).sort())
  })

  it('PUBLIC_FACILITATOR_NETWORKS ⊆ CANONICAL — the facilitator never offers an unconfirmable network', () => {
    for (const network of PUBLIC_FACILITATOR_NETWORKS) {
      expect(CANONICAL_X402_NETWORKS).toContain(network)
    }
  })

  it('CANONICAL ⊆ keys(USDC_ADDRESSES) — every canonical network has a pinned USDC contract', () => {
    for (const network of CANONICAL_X402_NETWORKS) {
      expect(Object.keys(USDC_ADDRESSES)).toContain(network)
    }
  })

  it('eip155:1 (Ethereum mainnet) is NOT canonical — unconfirmable by the reconciler', () => {
    expect(isCanonicalX402Network('eip155:1')).toBe(false)
    expect(CANONICAL_X402_NETWORKS).not.toContain('eip155:1')
  })

  it('Base mainnet and Base Sepolia ARE canonical', () => {
    expect(isCanonicalX402Network('eip155:8453')).toBe(true)
    expect(isCanonicalX402Network('eip155:84532')).toBe(true)
  })
})
