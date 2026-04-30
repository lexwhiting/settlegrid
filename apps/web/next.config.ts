import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'
import path from 'path'

const nextConfig: NextConfig = {
  output: 'standalone',
  outputFileTracingRoot: path.join(__dirname, '../../'),
  serverExternalPackages: ['postgres'],
  experimental: {
    // Unlock unauthorized()/forbidden() navigation helpers (Next 15.1+)
    // so server components can return proper 401/403 HTTP statuses.
    // Used by /admin/templater (P3.4).
    authInterrupts: true,
  },
  webpack: (config) => {
    // Inline markdown bodies for blog posts + Academy lessons as raw
    // strings at build time. Both directories share the asset/source
    // treatment so body-type content renders through the same
    // markdown pipeline server-side with no runtime fs access.
    config.module.rules.push({
      test: /\.md$/,
      include: [
        path.resolve(__dirname, 'src/lib/blog-bodies'),
        path.resolve(__dirname, 'src/lib/academy-bodies'),
      ],
      type: 'asset/source',
    })
    return config
  },
}

export default withSentryConfig(nextConfig, {
  // Suppresses all Sentry SDK build logs
  silent: true,
  // Disable source map uploads when no DSN is configured
  sourcemaps: {
    disable: !process.env.SENTRY_DSN,
  },
})
