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
  webpack: (config, { nextRuntime }) => {
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
    // Next compiles instrumentation.ts for BOTH the nodejs AND edge runtimes.
    // instrumentation.ts dynamically imports @/lib/db (postgres) inside a
    // `NEXT_RUNTIME === 'nodejs'` guard, but webpack still statically traces that
    // dynamic import into the EDGE bundle, where Node built-ins (net/tls/crypto/
    // stream/perf_hooks) don't exist → `Module not found: Can't resolve 'net'`
    // and the build fails. `serverExternalPackages` externalizes postgres for the
    // node server runtime only, not edge. The db path NEVER executes in edge (the
    // runtime guard), so stub those built-ins to empty modules for the edge build.
    if (nextRuntime === 'edge') {
      config.resolve = config.resolve ?? {}
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        perf_hooks: false,
        fs: false,
        dns: false,
        os: false,
      }
    }
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
