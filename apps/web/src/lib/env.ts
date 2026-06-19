let cached: ReturnType<typeof buildEnv> | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. ` +
        `Set it in your .env.local file or deployment environment.`
    )
  }
  return value
}

function buildEnv() {
  return {
    DATABASE_URL: requireEnv('DATABASE_URL'),
    REDIS_URL: requireEnv('REDIS_URL'),
    STRIPE_SECRET_KEY: requireEnv('STRIPE_SECRET_KEY'),
    RESEND_API_KEY: requireEnv('RESEND_API_KEY'),
    NEXT_PUBLIC_SUPABASE_URL: requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    NEXT_PUBLIC_APP_URL: requireEnv('NEXT_PUBLIC_APP_URL'),
  } as const
}

// Gate env vars — optional, only needed when password gate is enabled
export function getGatePassword(): string {
  return requireEnv('GATE_PASSWORD')
}

export function getGateSecret(): string {
  return requireEnv('GATE_SECRET')
}

// API key pepper — server secret keying the HMAC over API keys ((K) / DEBT #3).
// FAIL-CLOSED: required in EVERY environment (local/preview/prod). requireEnv
// throws on missing/empty, so a misconfigured pepper is a loud deploy error,
// never a silent degrade to the unkeyed legacy SHA-256 (auth is correctness,
// not anti-abuse — unlike the H1 rate-limiter's fail-open). Must be set in prod
// BEFORE the (K) code deploys: existing keys keep working via dual-read; new
// keys issue under HMAC. Operator residual: use a high-entropy value (>=32 bytes).
export function getApiKeyPepper(): string {
  return requireEnv('API_KEY_PEPPER')
}

// Individual lazy getters — only validate the var you actually need
export function getDatabaseUrl(): string {
  return requireEnv('DATABASE_URL')
}

export function getRedisUrl(): string {
  return requireEnv('REDIS_URL')
}

export function getStripeSecretKey(): string {
  return requireEnv('STRIPE_SECRET_KEY')
}

export function getStripeConnectClientId(): string | undefined {
  return process.env.STRIPE_CONNECT_CLIENT_ID
}

export function getStripeWebhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET
}

// Connect-mode webhook secret — separate endpoint that subscribes to
// connected-account events (payout.failed, etc). Distinct from the
// platform-mode STRIPE_WEBHOOK_SECRET because Stripe issues per-endpoint
// secrets and we run the two endpoints in parallel.
export function getStripeConnectWebhookSecret(): string | undefined {
  return process.env.STRIPE_CONNECT_WEBHOOK_SECRET
}

export function getResendApiKey(): string {
  return requireEnv('RESEND_API_KEY')
}

export function getSupabaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL')
}

export function getSupabaseAnonKey(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')
}

export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
}

export function getAppUrl(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL')
}

export function getUpstashRedisRestToken(): string {
  return requireEnv('UPSTASH_REDIS_REST_TOKEN')
}

// Cron secret — optional, only needed when cron endpoints are secured
export function getCronSecret(): string | undefined {
  return process.env.CRON_SECRET
}

// Health route — Redis connectivity check vars (optional)
export function getHealthRedisUrl(): string | undefined {
  return process.env.REDIS_URL
}

export function getHealthRedisToken(): string {
  return process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.REDIS_TOKEN ?? ''
}

// Gate auth timeout — optional, defaults to 24 hours
export function getGateAuthTimeoutHours(): number {
  return parseInt(process.env.GATE_AUTH_TIMEOUT_HOURS || '24', 10)
}

// Node env helper — safe to read directly but centralised here for consistency
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

// AP2 (Google Agentic Payments Protocol)
export function getAp2SigningSecret(): string {
  return process.env.AP2_SIGNING_SECRET ?? 'ap2-dev-secret'
}

export function getAp2VerificationKey(): string | undefined {
  return process.env.AP2_VERIFICATION_KEY
}

// Stripe MPP (Machine Payments Protocol)
export function getStripeMppSecret(): string | undefined {
  return process.env.STRIPE_MPP_SECRET
}

export function isMppEnabled(): boolean {
  return !!process.env.STRIPE_MPP_SECRET
}

export function getMppRecipientId(): string | undefined {
  return process.env.MPP_RECIPIENT_ID
}

// Visa TAP (Trusted Agent Protocol)
export function getVisaApiUrl(): string {
  return process.env.VISA_API_URL ?? 'https://sandbox.api.visa.com'
}

export function getVisaApiKey(): string | undefined {
  return process.env.VISA_API_KEY
}

export function getVisaSharedSecret(): string | undefined {
  return process.env.VISA_SHARED_SECRET
}

// Protocol enable checks — each protocol is enabled when its key env var is set

// x402: enabled when facilitator URL is set OR the gas wallet key is available
export function isX402Enabled(): boolean {
  return !!process.env.X402_FACILITATOR_URL || !!process.env.SETTLEGRID_GAS_WALLET_KEY
}

export function getX402FacilitatorUrl(): string | undefined {
  return process.env.X402_FACILITATOR_URL
}

/**
 * The platform USDC payee an x402 EIP-3009 authorization MUST pay
 * (`authorization.to`) — advertised as `payTo` in the x402 402 challenge and
 * ENFORCED by the proxy settlement verifier. Trimmed defensively (same
 * newline-in-env hazard as the gas key / circle-nano recipient); empty →
 * undefined. Should hold the SAME address as SETTLEGRID_USDC_RECIPIENT
 * (circle-nano's recipient) — one platform wallet for both EIP-3009 rails.
 */
export function getX402PaymentAddress(): string | undefined {
  return process.env.SETTLEGRID_PAYMENT_ADDRESS?.trim() || undefined
}

/**
 * x402 ON-CHAIN SETTLEMENT enable gate — distinct from {@link isX402Enabled}
 * (which only signals the legacy structural-accept path). The proxy settles
 * x402 on-chain only when BOTH the gas wallet key AND the platform payee are
 * configured (mirrors isCircleNanoKernelEnabled). Until the payee is set, x402
 * stays DARK (the proxy returns 402 not-configured) rather than
 * structural-accepting + crediting a developer balance for a payment that
 * never settles on-chain.
 */
export function isX402SettlementEnabled(): boolean {
  return !!process.env.SETTLEGRID_GAS_WALLET_KEY && !!getX402PaymentAddress()
}

/**
 * The ONLY x402 network whose settlements are accepted in production: Base
 * mainnet. Real money settles here. A testnet network (e.g. Base Sepolia
 * eip155:84532) moves FREE testnet USDC, so accepting one on a mainnet deploy
 * would mint a real, withdrawable developer-balance credit for $0 (seal-audit
 * F2). The proxy hard-pins to this in production.
 */
export const X402_MAINNET_NETWORK = 'eip155:8453' as const

/**
 * Whether the x402 proxy may settle a NON-mainnet (testnet) network. FALSE in
 * production unconditionally — even if SETTLEGRID_X402_ALLOW_TESTNET is set, a
 * production deploy is hard-pinned to {@link X402_MAINNET_NETWORK}, so a stray
 * flag can never re-open the free-testnet-USDC → real-credit hole (F2). In
 * non-production (local dev / a dedicated staging) testnet is allowed ONLY when
 * SETTLEGRID_X402_ALLOW_TESTNET === 'true' (explicit opt-in); otherwise non-prod
 * also defaults to mainnet-only. The Base-Sepolia e2e is unaffected — it drives
 * executeX402Settlement (the orchestrator) directly, not this proxy gate.
 */
export function isX402TestnetSettlementAllowed(): boolean {
  return process.env.SETTLEGRID_X402_ALLOW_TESTNET === 'true' && !isProduction()
}

// AP2: enabled when the signing secret or verification key is configured
export function isAp2Enabled(): boolean {
  return !!process.env.AP2_PROVIDER_KEY || !!process.env.AP2_SIGNING_SECRET || !!process.env.AP2_VERIFICATION_KEY
}

export function getAp2ProviderKey(): string | undefined {
  return process.env.AP2_PROVIDER_KEY
}

// Visa TAP: enabled when the Visa API key is set (VISA_TAP_API_KEY or VISA_API_KEY)
export function isVisaTapEnabled(): boolean {
  return !!process.env.VISA_TAP_API_KEY || !!process.env.VISA_API_KEY
}

export function getVisaTapApiKey(): string | undefined {
  return process.env.VISA_TAP_API_KEY ?? process.env.VISA_API_KEY
}

// ACP: enabled when the ACP Stripe key is set
export function isAcpEnabled(): boolean {
  return !!process.env.ACP_STRIPE_KEY
}

export function getAcpStripeKey(): string | undefined {
  return process.env.ACP_STRIPE_KEY
}

// Circle Nano (USDC EIP-3009 nanopayments) — kernel rail. The offline
// verifier needs only the platform USDC address that EIP-3009 authorizations
// must pay (`authorization.to`); NO Circle account or API key is required to
// verify + record. B1.1 made this recipient-based gate the SOLE circle-nano
// enablement gate — proxy dispatch + the unified enabledMap + the verifier all
// key on it; the legacy API-key gate (`isCircleNanoEnabled`/`CIRCLE_NANO_API_KEY`)
// was removed, so `CIRCLE_NANO_API_KEY` is now unread.
export function getCircleNanoRecipient(): string | undefined {
  // Trim defensively: the recipient is set via the Vercel dashboard/CLI and a
  // stray trailing newline (a known hazard for this deployment — the gas-wallet
  // key carries one) would otherwise fail the `isAddress` guard and silently
  // dark the rail. B1.1 now ADVERTISES this value in the 402, so a newline would
  // also silently drop `pay_to`. Normalizing here keeps the 402 advertise path
  // and the verifier (both read this getter) consistent. Empty → undefined.
  return process.env.SETTLEGRID_USDC_RECIPIENT?.trim() || undefined
}

export function isCircleNanoKernelEnabled(): boolean {
  // Derive from the normalized getter so a whitespace-only value can't report
  // "enabled" while the recipient resolves empty (which would 503 inconsistently).
  return !!getCircleNanoRecipient()
}

/**
 * Optional dedicated Base RPC endpoint for circle-nano on-chain settlement
 * (pre-submit reads + writeContract + receipt polling), per CAIP-2 network.
 * Returns undefined for an unset var or unknown network, so the caller falls
 * back to viem's default public RPC (`http()` with no URL).
 *
 * RPC flakiness is a LIVENESS risk, not a funds-safety risk here: a failed read
 * fails fast BEFORE any money moves, and a failed receipt-poll degrades to the
 * timeout path (a recoverable 'pending' row). The default public RPC is fine
 * for Base Sepolia testing and low volume, but it is rate-limited and not
 * SLA-backed.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ DEFERRED → A2 GO-LIVE: set SETTLEGRID_BASE_RPC_URL in Vercel prod to a     │
 * │ dedicated mainnet provider (Alchemy / QuickNode / Coinbase) BEFORE flipping│
 * │ circle-nano live. Recommended, not required (public fallback works). See   │
 * │ docs/tech-debt/a2-circle-nano-onchain-settlement-2026-05-30.md.            │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
export function getBaseRpcUrl(network: string): string | undefined {
  switch (network) {
    case 'eip155:8453':
      return process.env.SETTLEGRID_BASE_RPC_URL || undefined
    case 'eip155:84532':
      return process.env.SETTLEGRID_BASE_SEPOLIA_RPC_URL || undefined
    default:
      return undefined
  }
}

// L402 (Bitcoin Lightning)
export function isL402Enabled(): boolean {
  return process.env.L402_ENABLED === 'true' || !!process.env.LND_REST_URL
}

export function getLndRestUrl(): string | undefined {
  return process.env.LND_REST_URL
}

export function getLndMacaroonHex(): string | undefined {
  return process.env.LND_MACAROON_HEX
}

// ACTP — Alipay's Agentic Commerce Trust Protocol (Ant Group)
// Earlier internal SettleGrid drafts referred to this as "Alipay Trust"; the
// canonical spec name is "Agentic Commerce Trust Protocol" / ACTP. The env
// var prefix (ALIPAY_*) still uses "Alipay" because that's the provider
// brand, independent of the protocol rename.
export function isAlipayEnabled(): boolean {
  return !!process.env.ALIPAY_APP_ID
}

export function getAlipayAppId(): string | undefined {
  return process.env.ALIPAY_APP_ID
}

// KYAPay (Skyfire — Visa Intelligent Commerce)
export function isKyaPayEnabled(): boolean {
  return !!process.env.KYAPAY_VERIFICATION_KEY
}

export function getKyaPayVerificationKey(): string | undefined {
  return process.env.KYAPAY_VERIFICATION_KEY
}

// EMVCo Agent Payments
export function isEmvcoEnabled(): boolean {
  return process.env.EMVCO_ENABLED === 'true'
}

// DRAIN (Off-chain USDC via EIP-712 vouchers)
export function isDrainEnabled(): boolean {
  return process.env.DRAIN_ENABLED === 'true' || !!process.env.DRAIN_CHANNEL_ADDRESS
}

export function getDrainChannelAddress(): string | undefined {
  return process.env.DRAIN_CHANNEL_ADDRESS
}

/**
 * Feature flag for the unified-adapter dispatch path.
 *
 * When `true`, the marketplace proxy at /api/proxy/[slug] routes
 * payment-protocol detection through `protocolRegistry.detect()`
 * from the bundled `@settlegrid/mcp` adapters (Layer A) instead of
 * the historical 13-branch hand-rolled chain (Layer B).
 *
 * ## History
 *
 *   - P2.K1 shipped this flag defaulting to `false` (strict-truthy
 *     `'true'` only enables), so the legacy 13-branch chain remained
 *     authoritative while the unified path was shadow-validated.
 *   - P2.K2 migrated the validation + 402-generation logic into the
 *     adapter package so both dispatch paths delegate to the same
 *     underlying functions.
 *   - P2.K3 shipped the proxy-equivalence.test.ts snapshot test that
 *     asserts byte-parity between the two paths, and reordered the
 *     legacy chain to match the adapter registry's DETECTION_PRIORITY.
 *     After both, the two paths are provably equivalent and this
 *     function now DEFAULTS TO `true`. Set USE_UNIFIED_ADAPTERS='false'
 *     explicitly to opt out (operational rollback hatch if an unforeseen
 *     adapter-registry bug needs the legacy chain to take over).
 *
 * ## Value semantics (post-P2.K3 + P2.K3 hostile review)
 *
 *   - `'false'` / `'FALSE'` / `'False'` / ` false ` (any case + surrounding
 *     whitespace) → legacy 13-branch chain (opt-out).
 *   - anything else, including unset / undefined / empty string
 *     / `'true'` / `'TRUE'` / `'1'` / `'flase'` (typo) → unified.
 *
 * Two design tensions inform the case-insensitive, whitespace-tolerant
 * opt-out:
 *
 *   1. Typos in the OFF value should leave the unified path on — this
 *      is the rollout-safety argument (a fat-fingered operator doesn't
 *      silently revert to legacy during a routine deploy).
 *   2. Explicit OFF intent (operator sets `USE_UNIFIED_ADAPTERS=FALSE`
 *      as a rollback) MUST disable, regardless of case or surrounding
 *      whitespace — this is the operational-rollback argument. In an
 *      emergency, the operator should NOT have to discover the flag
 *      is case-sensitive via another failed deploy.
 *
 * P2.K3's initial implementation was strict-case (`!== 'false'`); the
 * hostile-review pass loosened it to `!== 'false'` after trim +
 * lowercase. Both intents are now satisfied: `'flase'` stays on (typo
 * → no match → not 'false' → unified), `'FALSE'` goes off (lowercased
 * to 'false' → match → legacy).
 */
export function useUnifiedAdapters(): boolean {
  return process.env.USE_UNIFIED_ADAPTERS?.trim().toLowerCase() !== 'false'
}

// ─── V-N3 ledger payer-PII minimization (DARK by default) ───────────────────
// Data-minimization path: a daily cron + a one-time admin backfill that, on
// TERMINAL + credit-resolved + aged x402/circle-nano settlement rows, rewrite
// `ledger_entries.operation_id` to drop the raw EVM payer+nonce and surgically
// null `metadata.payer` — removing the address from SettleGrid's queryable
// columns. The payer stays permanently public on-chain via `external_ref`, so
// this is MINIMIZATION, not erasure. Ships behind this disabled flag; flipping
// it on + running the backfill are SEPARATE counsel-gated acts (V-N3-erasure
// handoff §7). The window-floor SAFETY assert lives with the transform in
// settlement/anonymize-payer.ts (it binds to MAX_VALIDBEFORE_WINDOW_SECONDS).

/** DARK flag for the ledger payer-PII minimization cron + backfill. Strict-'true'
 *  (mirrors isEmvcoEnabled / X_ENABLED). Default OFF — both routes no-op while off. */
export function isLedgerPayerAnonymizeEnabled(): boolean {
  return process.env.LEDGER_PAYER_ANONYMIZE_ENABLED === 'true'
}

/** Retention window (days) after which an eligible payer-bearing row is minimized.
 *  Default = the documented 7-year (2555d) financial-retention period; counsel may
 *  choose shorter for PII minimization but NOT below the safety floor enforced in
 *  resolveAnonymizeWindowSeconds() (throws on a sub-floor value). A non-numeric /
 *  empty value returns the default; a present-but-too-small value is rejected at
 *  resolve time, not here, so the rejection carries the full floor context. */
export function getLedgerPayerAnonymizeAfterDays(): number {
  const raw = process.env.LEDGER_PAYER_ANONYMIZE_AFTER_DAYS
  if (raw == null || raw.trim() === '') return 2555
  return Number(raw) // NaN/sub-floor caught (throws) in resolveAnonymizeWindowSeconds
}

// Replicate API token — optional, needed for Replicate model crawler
export function getReplicateToken(): string | undefined {
  return process.env.REPLICATE_API_TOKEN
}

// GitHub PAT — optional, used for developer email resolution from public repos
export function getGitHubToken(): string | undefined {
  return process.env.GITHUB_TOKEN
}

// GitHub App — optional, only needed when GitHub App integration is configured
export function getGitHubAppId(): string | undefined {
  return process.env.GITHUB_APP_ID
}

export function getGitHubAppPrivateKey(): string | undefined {
  return process.env.GITHUB_APP_PRIVATE_KEY
}

export function getGitHubWebhookSecret(): string | undefined {
  return process.env.GITHUB_WEBHOOK_SECRET
}

// Full env object — validates ALL vars at once, cached after first call
export function getEnv() {
  if (!cached) {
    cached = buildEnv()
  }
  return cached
}
