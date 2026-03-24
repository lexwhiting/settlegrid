import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      })
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.SENTRY_DSN) {
      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        tracesSampleRate: 0.1,
        environment: process.env.NODE_ENV,
      })
    }
  }
}

// Capture errors from nested React Server Components
export const onRequestError = Sentry.captureRequestError
