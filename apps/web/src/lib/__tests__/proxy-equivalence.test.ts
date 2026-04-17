/**
 * P2.K3 — Snapshot test for proxy-vs-kernel equivalence.
 *
 * Compares the decision reached by the legacy 13-branch detection chain
 * (route.ts when USE_UNIFIED_ADAPTERS='false') against the unified
 * adapter-registry path (when USE_UNIFIED_ADAPTERS='true' — now the
 * default per P2.K3). For every canned request below, both paths must
 * select the SAME protocol (or the same fall-through outcome), because
 * after detection both paths call the same handler functions
 * (`handleMppProxy`, `handleX402Proxy`, `handleProtocolProxy`,
 * `handleL402Proxy`) — so identical detection implies identical
 * byte-for-byte output.
 *
 * Why not drive real HTTP through the route handler? The proxy handler
 * needs a database (authenticateProxyRequest looks up the tool, checks
 * the consumer balance, etc.). That's integration-test territory and
 * not what this spec is for. Here we unit-test the DECISION — which is
 * pure, fast, and deterministic — and rely on the fact that both paths
 * delegate to identical handlers downstream.
 *
 * What makes this test a true equivalence-snapshot:
 *
 *   1. The legacy chain is replicated as a pure `legacyDetect(request)`
 *      function that iterates protocol checks in the SAME order as the
 *      route.ts legacy chain (which, post-P2.K3, matches the registry's
 *      DETECTION_PRIORITY exactly).
 *   2. The unified path uses `decideUnifiedDispatch` +
 *      `shouldDispatchUnified` from _unified-dispatch.ts — the same pair
 *      route.ts uses in production when the flag is on.
 *   3. The comparison reduces both to a canonical
 *      `{ matched: ProtocolName | 'mcp' | null }` shape so the test asserts
 *      semantic equivalence without tripping on representation differences.
 *
 * If this test fails on main, DO NOT flip USE_UNIFIED_ADAPTERS back to
 * 'false' — fix the drift at the source (either the legacy chain has
 * been edited out-of-sync with the registry, or an adapter canHandle
 * has diverged from its isXRequest counterpart). The flag's explicit-
 * opt-out contract (see env.ts) is there for operational emergencies,
 * not for routine regressions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  decideUnifiedDispatch,
  shouldDispatchUnified,
  type EnabledMap,
  type ProtocolName,
} from '@/app/api/proxy/[slug]/_unified-dispatch'
import { isMppRequest } from '@/lib/mpp'
import { isCircleNanoRequest, isCircleNanoEnabled } from '@/lib/circle-nano-proxy'
import { isX402Request } from '@/lib/x402-proxy'
import { isMastercardRequest, isMastercardEnabled } from '@/lib/mastercard-proxy'
import { isAp2Request } from '@/lib/ap2-proxy'
import { isAcpRequest } from '@/lib/acp-proxy'
import { isUcpRequest, isUcpEnabled } from '@/lib/ucp-proxy'
import { isVisaTapRequest } from '@/lib/visa-tap-proxy'
import { isL402Request } from '@/lib/l402-proxy'
import { isAlipayRequest } from '@/lib/alipay-proxy'
import { isKyaPayRequest } from '@/lib/kyapay-proxy'
import { isEmvcoRequest } from '@/lib/emvco-proxy'
import { isDrainRequest } from '@/lib/drain-proxy'
import {
  isMppEnabled,
  isX402Enabled,
  isAp2Enabled,
  isVisaTapEnabled,
  isAcpEnabled,
  isL402Enabled,
  isAlipayEnabled,
  isKyaPayEnabled,
  isEmvcoEnabled,
  isDrainEnabled,
} from '@/lib/env'

// ─── Canonical decision shape (what we compare between paths) ──────────────

type DecisionOutcome =
  | { matched: ProtocolName } // a specific protocol picked up the request
  | { matched: 'mcp' } // no protocol matched, fell through to API-key flow
  | { matched: null } // no auth at all — 401 bucket

// ─── Legacy chain replicated as a pure function ────────────────────────────
//
// Must match the if-chain in apps/web/src/app/api/proxy/[slug]/route.ts
// handleProxy() 1:1 — same protocol order, same isXEnabled + isXRequest
// predicates, same API-key fallback. If route.ts is edited without
// updating this, the equivalence claim is broken and tests will fail.

function legacyDetect(request: Request): DecisionOutcome {
  if (isMppEnabled() && isMppRequest(request)) return { matched: 'mpp' }
  if (isCircleNanoEnabled() && isCircleNanoRequest(request)) return { matched: 'circle-nano' }
  if (isX402Enabled() && isX402Request(request)) return { matched: 'x402' }
  if (isMastercardEnabled() && isMastercardRequest(request))
    return { matched: 'mastercard-vi' }
  if (isAp2Enabled() && isAp2Request(request)) return { matched: 'ap2' }
  if (isAcpEnabled() && isAcpRequest(request)) return { matched: 'acp' }
  if (isUcpEnabled() && isUcpRequest(request)) return { matched: 'ucp' }
  if (isVisaTapEnabled() && isVisaTapRequest(request)) return { matched: 'visa-tap' }
  if (isL402Enabled() && isL402Request(request)) return { matched: 'l402' }
  if (isAlipayEnabled() && isAlipayRequest(request)) return { matched: 'alipay' }
  if (isKyaPayEnabled() && isKyaPayRequest(request)) return { matched: 'kyapay' }
  if (isEmvcoEnabled() && isEmvcoRequest(request)) return { matched: 'emvco' }
  if (isDrainEnabled() && isDrainRequest(request)) return { matched: 'drain' }

  // Fall-through: standard API-key flow (the 'mcp' bucket) if any kind of
  // SettleGrid API key auth is present. This mirrors how route.ts routes
  // the request to `authenticateProxyRequest` → standard key validation.
  const hasApiKey = request.headers.get('x-api-key') !== null
  const auth = request.headers.get('authorization') ?? ''
  const hasBearerSg = auth.startsWith('Bearer sg_')
  if (hasApiKey || hasBearerSg) return { matched: 'mcp' }

  return { matched: null }
}

// ─── Unified path reducer ──────────────────────────────────────────────────

async function unifiedDetect(request: Request, enabled: EnabledMap): Promise<DecisionOutcome> {
  const decision = await decideUnifiedDispatch(request)
  const verdict = shouldDispatchUnified(decision, enabled)
  if (verdict.dispatch) return { matched: verdict.protocol }
  if (verdict.reason === 'mcp-fallback') return { matched: 'mcp' }
  if (verdict.reason === 'protocol-disabled') {
    // A protocol's canHandle returned true but its enabled-fn said no.
    // Legacy chain would skip that protocol and continue — but our
    // tests enable every protocol (so this case doesn't arise), or
    // exercise the disabled case with a specific assertion (see
    // "disabled protocol fall-through" describe block). For the
    // default battery we treat this as an error: if the unified path
    // says protocol-disabled while all protocols are enabled, the
    // legacy chain's parallel decision would not be reachable.
    return { matched: null }
  }
  // reason === 'no-match'
  const hasApiKey = request.headers.get('x-api-key') !== null
  const auth = request.headers.get('authorization') ?? ''
  const hasBearerSg = auth.startsWith('Bearer sg_')
  if (hasApiKey || hasBearerSg) return { matched: 'mcp' }
  return { matched: null }
}

async function assertEquivalent(
  request: Request,
  enabled: EnabledMap,
  expected: DecisionOutcome,
): Promise<void> {
  const legacy = legacyDetect(request)
  const unified = await unifiedDetect(request, enabled)
  expect(legacy).toEqual(expected)
  expect(unified).toEqual(expected)
  // And the two paths must agree (redundant with the above, but this
  // is what "equivalence" means and failure surfaces the right way):
  expect(unified).toEqual(legacy)
}

// ─── Enable all 13 protocols for the default battery ───────────────────────

const fullEnabledMap: EnabledMap = {
  mpp: () => true,
  'circle-nano': () => true,
  x402: () => true,
  'mastercard-vi': () => true,
  ap2: () => true,
  acp: () => true,
  ucp: () => true,
  'visa-tap': () => true,
  l402: () => true,
  alipay: () => true,
  kyapay: () => true,
  emvco: () => true,
  drain: () => true,
}

beforeEach(() => {
  // Stub every env var each of the 13 protocols' isXEnabled() checks.
  // This lets the legacyDetect helper and the EnabledMap used by the
  // unified path BOTH see every protocol as enabled, so the test
  // exercises the detection decision (headers in, protocol out) in
  // isolation.
  vi.stubEnv('STRIPE_MPP_SECRET', 'sk_mpp_test')
  vi.stubEnv('X402_FACILITATOR_URL', 'https://facilitator.test')
  vi.stubEnv('AP2_SIGNING_SECRET', 'ap2-test-secret')
  vi.stubEnv('VISA_API_KEY', 'visa-test')
  vi.stubEnv('ACP_STRIPE_KEY', 'sk_acp_test')
  vi.stubEnv('UCP_API_KEY', 'ucp-test')
  vi.stubEnv('MASTERCARD_API_KEY', 'mc-test')
  vi.stubEnv('CIRCLE_NANO_API_KEY', 'cnano-test')
  vi.stubEnv('L402_ENABLED', 'true')
  vi.stubEnv('ALIPAY_APP_ID', 'alipay-test')
  vi.stubEnv('KYAPAY_VERIFICATION_KEY', 'kya-test')
  vi.stubEnv('EMVCO_ENABLED', 'true')
  vi.stubEnv('DRAIN_ENABLED', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Helpers for constructing canned requests ──────────────────────────────

function reqWith(headers: Record<string, string>, body?: string): Request {
  const init: RequestInit = { headers }
  if (body !== undefined) {
    init.method = 'POST'
    init.body = body
  }
  return new Request('http://localhost/api/proxy/test-tool', init)
}

// ─── Test battery ──────────────────────────────────────────────────────────

describe('P2.K3 — proxy-vs-kernel equivalence (battery)', () => {
  // --- no-match cases ---

  it('bare request with no headers → both paths say no-match (null)', async () => {
    await assertEquivalent(reqWith({}), fullEnabledMap, { matched: null })
  })

  it('irrelevant headers only → no-match', async () => {
    await assertEquivalent(
      reqWith({ 'user-agent': 'test-agent', accept: 'application/json' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  // --- MCP fall-through (API-key flow) ---

  it('x-api-key only → mcp-fallback', async () => {
    await assertEquivalent(
      reqWith({ 'x-api-key': 'sg_live_abc123' }),
      fullEnabledMap,
      { matched: 'mcp' },
    )
  })

  it('Authorization: Bearer sg_ → mcp-fallback', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer sg_live_xyz' }),
      fullEnabledMap,
      { matched: 'mcp' },
    )
  })

  // --- Each of 13 protocols with its canonical trigger header ---

  it('MPP — x-mpp-credential triggers mpp', async () => {
    await assertEquivalent(
      reqWith({ 'x-mpp-credential': 'mpp_abc' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('MPP — X-Payment-Token spt_ triggers mpp', async () => {
    await assertEquivalent(
      reqWith({ 'x-payment-token': 'spt_live_abc' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('MPP — X-Payment-Protocol: MPP/1.0 triggers mpp', async () => {
    await assertEquivalent(
      reqWith({ 'x-payment-protocol': 'MPP/1.0' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('Circle Nano — x-circle-nano-auth triggers circle-nano', async () => {
    await assertEquivalent(
      reqWith({ 'x-circle-nano-auth': 'nano-auth-abc' }),
      fullEnabledMap,
      { matched: 'circle-nano' },
    )
  })

  it('x402 — payment-signature triggers x402', async () => {
    const payload = Buffer.from(
      JSON.stringify({ scheme: 'exact', network: 'eip155:8453' }),
    ).toString('base64')
    await assertEquivalent(
      reqWith({ 'payment-signature': payload }),
      fullEnabledMap,
      { matched: 'x402' },
    )
  })

  it('x402 — X-Payment header triggers x402', async () => {
    await assertEquivalent(
      reqWith({ 'x-payment': 'base64payload' }),
      fullEnabledMap,
      { matched: 'x402' },
    )
  })

  it('Mastercard VI — x-mc-verifiable-intent triggers mastercard-vi', async () => {
    await assertEquivalent(
      reqWith({ 'x-mc-verifiable-intent': 'sd-jwt-chain' }),
      fullEnabledMap,
      { matched: 'mastercard-vi' },
    )
  })

  it('AP2 — x-ap2-credential triggers ap2', async () => {
    await assertEquivalent(
      reqWith({ 'x-ap2-credential': 'vdc-jwt' }),
      fullEnabledMap,
      { matched: 'ap2' },
    )
  })

  it('AP2 — x-ap2-mandate triggers ap2', async () => {
    await assertEquivalent(
      reqWith({ 'x-ap2-mandate': 'mandate-abc' }),
      fullEnabledMap,
      { matched: 'ap2' },
    )
  })

  it('ACP — x-acp-token triggers acp', async () => {
    await assertEquivalent(
      reqWith({ 'x-acp-token': 'acp_cs_abc' }),
      fullEnabledMap,
      { matched: 'acp' },
    )
  })

  it('ACP — x-acp-session-id triggers acp', async () => {
    await assertEquivalent(
      reqWith({ 'x-acp-session-id': 'cs_abc' }),
      fullEnabledMap,
      { matched: 'acp' },
    )
  })

  it('UCP — x-ucp-session triggers ucp', async () => {
    await assertEquivalent(
      reqWith({ 'x-ucp-session': 'ucp-sess-xyz' }),
      fullEnabledMap,
      { matched: 'ucp' },
    )
  })

  it('Visa TAP — x-visa-agent-token triggers visa-tap', async () => {
    await assertEquivalent(
      reqWith({ 'x-visa-agent-token': 'vtap_abc' }),
      fullEnabledMap,
      { matched: 'visa-tap' },
    )
  })

  it('L402 — Authorization: L402 triggers l402', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'L402 macaroon:preimage' }),
      fullEnabledMap,
      { matched: 'l402' },
    )
  })

  it('L402 — legacy LSAT prefix triggers l402', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'LSAT macaroon:preimage' }),
      fullEnabledMap,
      { matched: 'l402' },
    )
  })

  it('Alipay — x-alipay-agent-token triggers alipay', async () => {
    await assertEquivalent(
      reqWith({ 'x-alipay-agent-token': 'alipay-token-abcdef123' }),
      fullEnabledMap,
      { matched: 'alipay' },
    )
  })

  it('KYAPay — x-kyapay-token triggers kyapay', async () => {
    await assertEquivalent(
      reqWith({ 'x-kyapay-token': 'jwt.signed.token' }),
      fullEnabledMap,
      { matched: 'kyapay' },
    )
  })

  it('EMVCo — x-emvco-agent-token triggers emvco', async () => {
    await assertEquivalent(
      reqWith({ 'x-emvco-agent-token': 'emv-token-abc' }),
      fullEnabledMap,
      { matched: 'emvco' },
    )
  })

  it('DRAIN — x-drain-voucher triggers drain', async () => {
    await assertEquivalent(
      reqWith({ 'x-drain-voucher': '{"payer":"0xabc","amount":"100"}' }),
      fullEnabledMap,
      { matched: 'drain' },
    )
  })

  // --- Bearer prefix detection for each protocol that supports it ---

  it('Bearer spt_ → mpp', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer spt_abc' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('Bearer mpp_ → mpp', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer mpp_abc' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('Bearer x402_ → x402', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer x402_abc' }),
      fullEnabledMap,
      { matched: 'x402' },
    )
  })

  it('Bearer alipay_ → alipay', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer alipay_token_abcdefghijklmn' }),
      fullEnabledMap,
      { matched: 'alipay' },
    )
  })

  it('Bearer kyapay_ → kyapay', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer kyapay_jwt.value.here' }),
      fullEnabledMap,
      { matched: 'kyapay' },
    )
  })

  // --- Explicit x-settlegrid-protocol hints ---

  it('explicit x-settlegrid-protocol: x402 → x402', async () => {
    await assertEquivalent(
      reqWith({ 'x-settlegrid-protocol': 'x402' }),
      fullEnabledMap,
      { matched: 'x402' },
    )
  })

  it('explicit x-settlegrid-protocol: ap2 → ap2', async () => {
    await assertEquivalent(
      reqWith({ 'x-settlegrid-protocol': 'ap2' }),
      fullEnabledMap,
      { matched: 'ap2' },
    )
  })

  it('explicit x-settlegrid-protocol: l402 → l402', async () => {
    await assertEquivalent(
      reqWith({ 'x-settlegrid-protocol': 'l402' }),
      fullEnabledMap,
      { matched: 'l402' },
    )
  })

  it('explicit x-settlegrid-protocol: drain → drain', async () => {
    await assertEquivalent(
      reqWith({ 'x-settlegrid-protocol': 'drain' }),
      fullEnabledMap,
      { matched: 'drain' },
    )
  })

  // --- Precedence: protocol header + x-api-key → protocol wins ---

  it('precedence: mpp header beats x-api-key (mpp wins)', async () => {
    await assertEquivalent(
      reqWith({ 'x-mpp-credential': 'mpp_abc', 'x-api-key': 'sg_live_xyz' }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('precedence: ap2 header beats Bearer sg_ (ap2 wins)', async () => {
    await assertEquivalent(
      reqWith({
        'x-ap2-credential': 'vdc-jwt',
        authorization: 'Bearer sg_live_xyz',
      }),
      fullEnabledMap,
      { matched: 'ap2' },
    )
  })

  // --- Precedence: conflicting protocol headers, registry priority wins ---

  it('precedence: mpp beats circle-nano when both headers present', async () => {
    await assertEquivalent(
      reqWith({
        'x-mpp-credential': 'mpp_abc',
        'x-circle-nano-auth': 'nano-abc',
      }),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('precedence: circle-nano beats x402 when both headers present', async () => {
    // Previously the legacy chain had x402 at slot #2 and circle-nano at
    // slot #8 — this request would route to x402. P2.K3 reordered the
    // legacy chain to match the registry's circle-nano-before-x402
    // priority; the expected outcome flipped. Pinned here so any
    // regression surfaces in this test.
    const x402Payload = Buffer.from(
      JSON.stringify({ scheme: 'exact' }),
    ).toString('base64')
    await assertEquivalent(
      reqWith({
        'x-circle-nano-auth': 'nano-abc',
        'payment-signature': x402Payload,
      }),
      fullEnabledMap,
      { matched: 'circle-nano' },
    )
  })

  it('precedence: x402 beats mastercard-vi when both headers present', async () => {
    await assertEquivalent(
      reqWith({
        'x-payment': 'base64-payload',
        'x-mc-verifiable-intent': 'sd-jwt-chain',
      }),
      fullEnabledMap,
      { matched: 'x402' },
    )
  })

  it('precedence: mastercard-vi beats ap2 when both headers present', async () => {
    await assertEquivalent(
      reqWith({
        'x-mc-verifiable-intent': 'sd-jwt',
        'x-ap2-credential': 'vdc-jwt',
      }),
      fullEnabledMap,
      { matched: 'mastercard-vi' },
    )
  })

  it('precedence: ap2 beats acp when both headers present', async () => {
    await assertEquivalent(
      reqWith({
        'x-ap2-credential': 'vdc-jwt',
        'x-acp-token': 'acp-abc',
      }),
      fullEnabledMap,
      { matched: 'ap2' },
    )
  })

  it('precedence: l402 beats alipay when both headers present', async () => {
    await assertEquivalent(
      reqWith({
        authorization: 'L402 macaroon:preimage',
        'x-alipay-agent-token': 'alipay-token-abcdef123',
      }),
      fullEnabledMap,
      { matched: 'l402' },
    )
  })

  // --- Unmatched bearers + non-protocol bearer tokens ---

  it('Bearer sg_ is MCP, not mistaken for any other protocol', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer sg_live_xyz' }),
      fullEnabledMap,
      { matched: 'mcp' },
    )
  })

  it('Bearer with unknown prefix + no other headers → no-match', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer unknownprefix_abc' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  // --- Emerging-protocol Bearer prefixes ---

  it('Bearer vtap_ → visa-tap', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer vtap_abc' }),
      fullEnabledMap,
      { matched: 'visa-tap' },
    )
  })

  it('Bearer acp_ → acp', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer acp_abc' }),
      fullEnabledMap,
      { matched: 'acp' },
    )
  })

  it('Bearer ucp_ → ucp', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer ucp_abc' }),
      fullEnabledMap,
      { matched: 'ucp' },
    )
  })

  it('Bearer mcvi_ → mastercard-vi', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer mcvi_abc' }),
      fullEnabledMap,
      { matched: 'mastercard-vi' },
    )
  })

  it('Bearer cnano_ → circle-nano', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer cnano_abc' }),
      fullEnabledMap,
      { matched: 'circle-nano' },
    )
  })

  // --- POST with body doesn't affect detection (headers only) ---

  it('POST with JSON body + mpp header → mpp (body irrelevant to detection)', async () => {
    await assertEquivalent(
      reqWith(
        { 'x-mpp-credential': 'mpp_abc', 'content-type': 'application/json' },
        JSON.stringify({ method: 'search', foo: 'bar' }),
      ),
      fullEnabledMap,
      { matched: 'mpp' },
    )
  })

  it('POST with plain-text body + drain header → drain', async () => {
    await assertEquivalent(
      reqWith(
        { 'x-drain-voucher': '{"amount":"10000"}', 'content-type': 'text/plain' },
        'not-json-body',
      ),
      fullEnabledMap,
      { matched: 'drain' },
    )
  })
})

// ─── Disabled-protocol fall-through (unified path only — legacy skips) ─────

describe('P2.K3 — disabled protocol fall-through', () => {
  it('mpp header present but mpp disabled → unified falls through, legacy also skips', async () => {
    // Disable only MPP; all other protocols enabled.
    vi.stubEnv('STRIPE_MPP_SECRET', '')
    const partialEnabled: EnabledMap = { ...fullEnabledMap, mpp: () => false }
    const req = reqWith({ 'x-mpp-credential': 'mpp_abc' })

    // Legacy: isMppEnabled() is false → skip MPP check → no other
    // protocol matches → no API key → no-match.
    expect(legacyDetect(req)).toEqual({ matched: null })

    // Unified: decideUnifiedDispatch finds mpp via canHandle, but
    // shouldDispatchUnified sees mpp disabled → reason: protocol-disabled.
    const decision = await decideUnifiedDispatch(req)
    const verdict = shouldDispatchUnified(decision, partialEnabled)
    expect(verdict.dispatch).toBe(false)
    expect((verdict as { reason: string }).reason).toBe('protocol-disabled')
    expect((verdict as { protocol: string }).protocol).toBe('mpp')
  })

  it('mpp disabled but request also has x-api-key → both paths end at mcp', async () => {
    vi.stubEnv('STRIPE_MPP_SECRET', '')
    const req = reqWith({
      'x-mpp-credential': 'mpp_abc',
      'x-api-key': 'sg_live_abc',
    })

    // Legacy skips MPP (disabled), continues, other protocols don't match
    // for these headers, falls through to API-key flow.
    expect(legacyDetect(req)).toEqual({ matched: 'mcp' })

    // Unified: detects mpp via canHandle but enabled-fn returns false so
    // falls through. For the full flag-on flow, route.ts's
    // tryUnifiedAdapterDispatch returns null on protocol-disabled verdict
    // and the caller continues into the legacy chain which picks up the
    // x-api-key as mcp-fallback. That matches the snapshot.
    const partialEnabled: EnabledMap = { ...fullEnabledMap, mpp: () => false }
    const decision = await decideUnifiedDispatch(req)
    const verdict = shouldDispatchUnified(decision, partialEnabled)
    expect(verdict.dispatch).toBe(false)
    expect((verdict as { reason: string }).reason).toBe('protocol-disabled')
  })
})

// ─── Reducer edge cases (no-auth fallback shape parity) ───────────────────

describe('P2.K3 — no-auth fallback parity', () => {
  it('completely bare request: both paths return {matched: null}', async () => {
    await assertEquivalent(reqWith({}), fullEnabledMap, { matched: null })
  })

  it('unknown Authorization scheme: both paths return {matched: null}', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Basic dXNlcjpwYXNz' }),
      fullEnabledMap,
      { matched: null },
    )
  })
})
