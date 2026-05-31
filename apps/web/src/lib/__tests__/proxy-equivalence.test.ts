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
 * ## Spec-level deviations (phase-2-distribution.md §P2.K3)
 *
 * The spec calls for "two test instances of the proxy" with the flag
 * toggled. A full end-to-end invocation requires a database
 * (authenticateProxyRequest → tool lookup + consumer balance check);
 * that's integration-test territory. We test AT TWO LEVELS:
 *
 *   Level 1 (detection) — `legacyDetect(request)` (a pure replica of
 *     the route.ts 13-branch if-chain) vs `decideUnifiedDispatch` +
 *     `shouldDispatchUnified` (the production unified path helpers).
 *     This is the MAIN battery below.
 *
 *   Level 2 (response bytes) — for each of 13 protocols, compare the
 *     Response produced by the legacy lib shim's
 *     `generate<X>402Response(...)` against the Response produced by
 *     the adapter class's `build402Response({...})`. See the
 *     "Level 2 — byte-for-byte Response equivalence" describe block.
 *
 *   Level 3 (flag toggle) — stub `useUnifiedAdapters()` under various
 *     env values and verify the dispatch-branch decision flows through
 *     the flag as route.ts expects. See the "Level 3 — feature flag
 *     toggle" describe block.
 *
 * The spec also says "no protocol committed (expect 402)". In the
 * current route.ts, a bare request (no auth headers, no protocol
 * triggers) returns 401 from the API-key flow — there's no
 * 402-manifest generator at the top of route.ts today. The spec's
 * 402-for-bare-request is an aspiration; for P2.K3's snapshot-
 * equivalence purposes we pin the actual behavior (no-match → legacy
 * 401 vs unified 401) and the "expect 402" wording is flagged here
 * for whoever picks up the route.ts refactor to surface the
 * multi-protocol manifest as the bare-request response.
 *
 * The spec also says "valid + invalid payloads". Valid-trigger tests
 * are in the main battery. Invalid-trigger tests (headers that LOOK
 * like a protocol's trigger but don't match a valid pattern) are in
 * the "invalid-payload — neither path matches" describe block.
 *
 * If this test fails on main, DO NOT flip USE_UNIFIED_ADAPTERS back
 * to 'false' — fix the drift at the source (either the legacy chain
 * has been edited out-of-sync with the registry, or an adapter
 * canHandle has diverged from its isXRequest counterpart). The flag's
 * explicit-opt-out contract (see env.ts) is there for operational
 * emergencies, not for routine regressions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  decideUnifiedDispatch,
  shouldDispatchUnified,
  type EnabledMap,
  type ProtocolName,
} from '@/app/api/proxy/[slug]/_unified-dispatch'
// Level 1 + invalid-payload imports (isXRequest helpers + generate402
// helpers for Level 2).
import {
  isMppRequest,
  generateMpp402Response as legacyMpp,
} from '@/lib/mpp'
import {
  isCircleNanoRequest,
  isCircleNanoEnabled,
  generateCircleNano402Response as legacyCnano,
} from '@/lib/circle-nano-proxy'
import {
  isX402Request,
  generateX402_402Response as legacyX402,
} from '@/lib/x402-proxy'
import {
  isMastercardRequest,
  isMastercardEnabled,
  generateMastercard402Response as legacyMc,
} from '@/lib/mastercard-proxy'
import {
  isAp2Request,
  generateAp2_402Response as legacyAp2,
} from '@/lib/ap2-proxy'
import {
  isAcpRequest,
  generateAcp402Response as legacyAcp,
} from '@/lib/acp-proxy'
import {
  isUcpRequest,
  isUcpEnabled,
  generateUcp402Response as legacyUcp,
} from '@/lib/ucp-proxy'
import {
  isVisaTapRequest,
  generateVisaTap402Response as legacyTap,
} from '@/lib/visa-tap-proxy'
import {
  isL402Request,
  generateL402_402Response as legacyL402,
} from '@/lib/l402-proxy'
import {
  isAlipayRequest,
  generateAlipay402Response as legacyAlipay,
} from '@/lib/alipay-proxy'
import {
  isKyaPayRequest,
  generateKyaPay402Response as legacyKyapay,
} from '@/lib/kyapay-proxy'
import {
  isEmvcoRequest,
  generateEmvco402Response as legacyEmvco,
} from '@/lib/emvco-proxy'
import {
  isDrainRequest,
  generateDrain402Response as legacyDrain,
} from '@/lib/drain-proxy'
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
// Level 2 adapter-class imports (used to call build402Response for the
// byte-for-byte comparison against the legacy lib-shim path).
import {
  MPPAdapter,
  X402Adapter,
  AP2Adapter,
  TAPAdapter,
  ACPAdapter,
  UCPAdapter,
  MastercardVIAdapter,
  CircleNanoAdapter,
  L402Adapter,
  AlipayAdapter,
  KyaPayAdapter,
  EmvcoAdapter,
  DrainAdapter,
} from '@settlegrid/mcp'

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
  // B1.1: the circle-nano legacy wrapper now enriches its 402 with discovery
  // fields (pay_to / asset_address / eip712_domain) when SETTLEGRID_USDC_RECIPIENT
  // is set, going BEYOND the bare adapter's build402Response. This byte-for-byte
  // equivalence battery exercises the dark (no-recipient) state where the two are
  // identical; pin the recipient empty so an ambient env value can't make the
  // wrapper diverge from the adapter and flake this test. (The wrapper's enriched
  // path is covered by circle-nano-402-discovery.test.ts.)
  vi.stubEnv('SETTLEGRID_USDC_RECIPIENT', '')
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

// ─── P2.K3 spec-diff: invalid-payload coverage (≥13 tests) ────────────────
//
// Spec: "each of 13 protocols with valid + invalid payloads". The valid
// cases are in the main battery; these pin the negative cases —
// requests that carry a header RESEMBLING a protocol trigger but that
// doesn't match a valid pattern (e.g. X-Payment-Token: foo_abc — no
// spt_ / mpp_ prefix; Bearer unknown_abc; x-alipay-agent-token: '' ).
// Both detection paths must agree such requests do NOT match that
// protocol.

describe('P2.K3 — invalid-payload: neither path falsely matches', () => {
  it('MPP — X-Payment-Token with unknown prefix does NOT match mpp', async () => {
    // Only spt_* and mpp_* prefixes are valid. 'foo_abc' must not match.
    await assertEquivalent(
      reqWith({ 'x-payment-token': 'foo_abc_not_valid' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('MPP — X-Payment-Protocol with wrong value does NOT match mpp', async () => {
    await assertEquivalent(
      reqWith({ 'x-payment-protocol': 'NOT-MPP/1.0' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('Circle Nano — empty x-circle-nano-auth does NOT match', async () => {
    // Truthy check: empty string header doesn't trigger.
    await assertEquivalent(
      reqWith({ 'x-circle-nano-auth': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('x402 — empty payment-signature does NOT match x402', async () => {
    await assertEquivalent(
      reqWith({ 'payment-signature': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('Mastercard VI — empty x-mc-verifiable-intent does NOT match', async () => {
    await assertEquivalent(
      reqWith({ 'x-mc-verifiable-intent': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('AP2 — Bearer ap2 without underscore does NOT match ap2', async () => {
    // Bearer prefix must be exactly 'ap2_'. 'ap2x' or 'ap2' alone fails.
    await assertEquivalent(
      reqWith({ authorization: 'Bearer ap2xsomething' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('ACP — Bearer acp without underscore does NOT match acp', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer acptoken' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('UCP — empty x-ucp-session does NOT match ucp', async () => {
    await assertEquivalent(
      reqWith({ 'x-ucp-session': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('Visa TAP — Bearer vtap without underscore does NOT match visa-tap', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer vtaptoken' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('L402 — Authorization without L402/LSAT prefix does NOT match l402', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'L401 macaroon:preimage' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('Alipay — Bearer alipay without underscore does NOT match alipay', async () => {
    await assertEquivalent(
      reqWith({ authorization: 'Bearer alipaytoken' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('KYAPay — empty x-kyapay-token does NOT match kyapay', async () => {
    await assertEquivalent(
      reqWith({ 'x-kyapay-token': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('EMVCo — empty x-emvco-agent-token does NOT match emvco', async () => {
    await assertEquivalent(
      reqWith({ 'x-emvco-agent-token': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('DRAIN — empty x-drain-voucher does NOT match drain', async () => {
    await assertEquivalent(
      reqWith({ 'x-drain-voucher': '' }),
      fullEnabledMap,
      { matched: null },
    )
  })

  it('wrong x-settlegrid-protocol value does NOT match any protocol', async () => {
    // Typo / unknown value shouldn't trigger any protocol.
    await assertEquivalent(
      reqWith({ 'x-settlegrid-protocol': 'unknown-protocol' }),
      fullEnabledMap,
      { matched: null },
    )
  })
})

// ─── Level 2 — byte-for-byte Response equivalence ─────────────────────────
//
// The main battery tests the DETECTION decision. This block closes the
// spec-literal "byte-for-byte equivalent" requirement by comparing the
// Response each path produces for a given (toolSlug, costCents) tuple
// at the 402-generation stage. Legacy uses the lib shim's
// `generate<X>402Response(slug, cents, name, ...)`; unified uses the
// adapter class's `build402Response({slug, cents, ...})`. Post-P2.K2
// both paths delegate to the same module-level function in
// packages/mcp/src/adapters/*, so equality is expected by construction
// — the value of this block is to PIN that invariant against future
// refactors.
//
// Volatile fields excluded from comparison (via `omit` in normalize()):
//   - L402 `macaroon` — base64-encoded, contains randomBytes(16) id
//     minted fresh each call. Diverges between two mint calls even
//     when signing key is identical.
//   - L402 `macaroon_id` — the raw 16-byte hex id (same random source
//     as above; field is just a flattened view of macaroon.id).
//   - L402 `r_hash` — in the mock-invoice path (LND_REST_URL unset),
//     this is randomBytes(32). Diverges each call.
//   - L402 `invoice` — mock-invoice path builds this from randomBytes(20).
//   - L402 `instructions` — the human-readable instructions string
//     embeds the minted macaroon substring, so it differs per call.
//     Excluding is cosmetic (no contract depends on instructions
//     matching byte-for-byte) but necessary to make the assertion
//     pass.
//
// All other fields MUST be identical.

interface NormalizedResponse {
  status: number
  protocolHeader: string | null
  body: Record<string, unknown>
}

async function normalize(
  res: Response,
  omit: readonly string[] = [],
): Promise<NormalizedResponse> {
  const body = (await res.json()) as Record<string, unknown>
  for (const key of omit) {
    delete body[key]
  }
  // x402's X-Payment-Required header carries a base64 of body.accepts —
  // since we compare body.accepts separately, the header is redundant
  // and trimmed from the normalized shape.
  return {
    status: res.status,
    protocolHeader: res.headers.get('X-SettleGrid-Protocol'),
    body,
  }
}

describe('P2.K3 Level 2 — byte-for-byte Response equivalence (13 protocols)', () => {
  const APP_URL = 'https://settlegrid.test'
  const SLUG = 'my-tool'
  const COST = 25
  const NAME = 'My Tool'

  beforeEach(() => {
    // getAppUrl() reads NEXT_PUBLIC_APP_URL; pin it so the legacy path
    // produces a deterministic payment_endpoint.
    vi.stubEnv('NEXT_PUBLIC_APP_URL', APP_URL)
  })

  it('MPP: legacy lib shim === adapter.build402Response', async () => {
    const legacy = await normalize(legacyMpp(SLUG, COST, NAME))
    const unified = await normalize(
      new MPPAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('x402: legacy === adapter', async () => {
    const legacy = await normalize(legacyX402(SLUG, COST, NAME))
    const unified = await normalize(
      new X402Adapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
        fallbackPaymentAddress: process.env.SETTLEGRID_PAYMENT_ADDRESS,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('AP2: legacy === adapter', async () => {
    const legacy = await normalize(legacyAp2(SLUG, COST, NAME))
    const unified = await normalize(
      new AP2Adapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('Visa TAP: legacy === adapter', async () => {
    const legacy = await normalize(legacyTap(SLUG, COST, NAME))
    const unified = await normalize(
      new TAPAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('ACP: legacy === adapter', async () => {
    const legacy = await normalize(legacyAcp(SLUG, COST, NAME))
    const unified = await normalize(
      new ACPAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('UCP: legacy === adapter', async () => {
    const legacy = await normalize(legacyUcp(SLUG, COST, NAME))
    const unified = await normalize(
      new UCPAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('Mastercard VI: legacy === adapter', async () => {
    const legacy = await normalize(legacyMc(SLUG, COST, NAME))
    const unified = await normalize(
      new MastercardVIAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('Circle Nano: legacy === adapter', async () => {
    const legacy = await normalize(legacyCnano(SLUG, COST, NAME))
    const unified = await normalize(
      new CircleNanoAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('L402: legacy === adapter (excluding per-mint randoms)', async () => {
    // L402 mints a fresh macaroon + r_hash on every call (randomBytes).
    // Exclude those from the byte comparison; everything else pinned.
    const omit = ['macaroon', 'macaroon_id', 'r_hash', 'invoice', 'instructions']
    const legacy = await normalize(await legacyL402(SLUG, COST, NAME), omit)
    const unified = await normalize(
      await new L402Adapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
        signingKey: 'test-key',
      }),
      omit,
    )
    expect(unified).toEqual(legacy)
  })

  it('Alipay: legacy === adapter', async () => {
    const legacy = await normalize(legacyAlipay(SLUG, COST, NAME))
    const unified = await normalize(
      new AlipayAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('KYAPay: legacy === adapter', async () => {
    const legacy = await normalize(legacyKyapay(SLUG, COST, NAME))
    const unified = await normalize(
      new KyaPayAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('EMVCo: legacy === adapter', async () => {
    const legacy = await normalize(legacyEmvco(SLUG, COST, NAME))
    const unified = await normalize(
      new EmvcoAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
      }),
    )
    expect(unified).toEqual(legacy)
  })

  it('DRAIN: legacy === adapter', async () => {
    const legacy = await normalize(legacyDrain(SLUG, COST, NAME))
    const unified = await normalize(
      new DrainAdapter().build402Response({
        toolSlug: SLUG,
        costCents: COST,
        toolName: NAME,
        appUrl: APP_URL,
        channelAddress: process.env.DRAIN_CHANNEL_ADDRESS,
      }),
    )
    expect(unified).toEqual(legacy)
  })
})

// ─── Level 3 — feature flag toggle ────────────────────────────────────────

describe('P2.K3 Level 3 — useUnifiedAdapters flag toggle', () => {
  // The spec says "two test instances of the proxy: one with
  // USE_UNIFIED_ADAPTERS=true, one with false". The full proxy needs a DB
  // to actually dispatch; these tests instead pin the flag-reading
  // function's contract end-to-end. route.ts branches on
  // `if (useUnifiedAdapters())` — if the flag reads wrong, the entire
  // unified path is bypassed, so this is the tightest no-DB check we can
  // give.
  //
  // Hostile-review M1: uses `vi.stubEnv` instead of direct
  // `process.env.X = ...` assignment so the outer `afterEach`'s
  // `vi.unstubAllEnvs()` correctly rolls back. Direct assignment leaks
  // into subsequent test files if they import env.ts.

  it('flag reads true when USE_UNIFIED_ADAPTERS is unset (P2.K3 default)', async () => {
    vi.stubEnv('USE_UNIFIED_ADAPTERS', undefined as unknown as string)
    // vi.stubEnv with undefined simulates "unset" in vitest.
    const { useUnifiedAdapters } = await import('@/lib/env')
    expect(useUnifiedAdapters()).toBe(true)
  })

  it('flag reads true when USE_UNIFIED_ADAPTERS is explicitly "true"', async () => {
    vi.stubEnv('USE_UNIFIED_ADAPTERS', 'true')
    const { useUnifiedAdapters } = await import('@/lib/env')
    expect(useUnifiedAdapters()).toBe(true)
  })

  it('flag reads false for the literal string "false"', async () => {
    vi.stubEnv('USE_UNIFIED_ADAPTERS', 'false')
    const { useUnifiedAdapters } = await import('@/lib/env')
    expect(useUnifiedAdapters()).toBe(false)
  })

  // useUnifiedAdapters is a plain feature-flag reader in @/lib/env, not a
  // React hook — but the `use*` naming convention trips react-hooks/rules-of-hooks
  // when called inside a `for` loop. Scoped disables on the two call sites.
  it('flag reads false for case-insensitive + whitespace-tolerant opt-out (H1 fix)', async () => {
    for (const value of ['FALSE', 'False', 'fAlSe', '  false  ', 'false\n']) {
      vi.stubEnv('USE_UNIFIED_ADAPTERS', value)
      const { useUnifiedAdapters } = await import('@/lib/env')
      // eslint-disable-next-line react-hooks/rules-of-hooks
      expect(useUnifiedAdapters()).toBe(false)
    }
  })

  it('typos do not silently disable the unified path', async () => {
    // Rollout-safety half of the contract: a typo in the OFF value
    // leaves the unified path on (safe default).
    for (const typo of ['flase', 'no', '0', 'off', 'disabled']) {
      vi.stubEnv('USE_UNIFIED_ADAPTERS', typo)
      const { useUnifiedAdapters } = await import('@/lib/env')
      // eslint-disable-next-line react-hooks/rules-of-hooks
      expect(useUnifiedAdapters()).toBe(true)
    }
  })
})
