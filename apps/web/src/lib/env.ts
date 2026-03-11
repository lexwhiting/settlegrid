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
    STRIPE_CONNECT_CLIENT_ID: requireEnv('STRIPE_CONNECT_CLIENT_ID'),
    STRIPE_WEBHOOK_SECRET: requireEnv('STRIPE_WEBHOOK_SECRET'),
    RESEND_API_KEY: requireEnv('RESEND_API_KEY'),
    JWT_SECRET: requireEnv('JWT_SECRET'),
    NEXT_PUBLIC_APP_URL: requireEnv('NEXT_PUBLIC_APP_URL'),
  } as const
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

export function getJwtSecret(): string {
  return requireEnv('JWT_SECRET')
}

export function getAppUrl(): string {
  return requireEnv('NEXT_PUBLIC_APP_URL')
}

// Full env object — validates ALL vars at once, cached after first call
export function getEnv() {
  if (!cached) {
    cached = buildEnv()
  }
  return cached
}
