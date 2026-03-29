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

// Alipay Trust Protocol
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
