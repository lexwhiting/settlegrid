import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/api/v1/discover',
          '/api/feed',
          '/api/openapi.json',
          '/api/badge/',
          '/api/widget/',
          '/api/marketplace/stats',
          '/api/marketplace/bundles',
          '/api/tools/serve/',
        ],
        disallow: [
          '/api/',
          '/dashboard/',
          '/consumer/',
        ],
      },
    ],
    sitemap: 'https://settlegrid.ai/sitemap.xml',
  }
}
