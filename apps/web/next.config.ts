import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['postgres'],
}

export default withSentryConfig(nextConfig, {
  // Suppresses all Sentry SDK build logs
  silent: true,
  // Disable source map uploads when no DSN is configured
  sourcemaps: {
    disable: !process.env.SENTRY_DSN,
  },
})
