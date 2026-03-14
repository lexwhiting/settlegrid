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
    CLERK_SECRET_KEY: requireEnv('CLERK_SECRET_KEY'),
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

export function getStripeConnectClientId(): string {
  return requireEnv('STRIPE_CONNECT_CLIENT_ID')
}

export function getStripeWebhookSecret(): string {
  return requireEnv('STRIPE_WEBHOOK_SECRET')
}

export function getResendApiKey(): string {
  return requireEnv('RESEND_API_KEY')
}

export function getClerkSecretKey(): string {
  return requireEnv('CLERK_SECRET_KEY')
}

export function getClerkWebhookSecret(): string {
  return requireEnv('CLERK_WEBHOOK_SECRET')
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

// Full env object — validates ALL vars at once, cached after first call
export function getEnv() {
  if (!cached) {
    cached = buildEnv()
  }
  return cached
}
