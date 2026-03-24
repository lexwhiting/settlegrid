import type { MetadataRoute } from 'next'

const BASE_URL = 'https://settlegrid.ai'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  return [
    // ── Marketing pages ──────────────────────────────────────────────────────
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/docs`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/tools`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/servers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/developers`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },

    // ── Learn hub & FAQ ────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/learn/handbook`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/learn/protocols`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...(['mcp', 'mpp', 'x402', 'ap2', 'visa-tap', 'ucp', 'acp', 'mastercard-agent-pay', 'circle-nanopayments', 'rest'] as const).map(
      (slug) => ({
        url: `${BASE_URL}/learn/protocols/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })
    ),
    {
      url: `${BASE_URL}/learn/compare`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    ...(['vs-diy', 'vs-nevermined', 'vs-stripe'] as const).map(
      (slug) => ({
        url: `${BASE_URL}/learn/compare/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.5,
      })
    ),
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Auth pages ───────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/register`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // ── Legal ────────────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/privacy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${BASE_URL}/terms`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.3,
    },

    // ── LLM-readable content ─────────────────────────────────────────────────
    {
      url: `${BASE_URL}/llms.txt`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/llms-full.txt`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // ── API documentation ────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/api/openapi.json`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },

    // ── Discovery API (public, no auth) ────────────────────────────────────
    {
      url: `${BASE_URL}/api/v1/discover`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/api/v1/discover/categories`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.5,
    },

    // ── Discovery infrastructure ────────────────────────────────────────
    {
      url: `${BASE_URL}/.well-known/agent-card.json`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/.well-known/mcp/server-card.json`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/api/feed`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  ]
}
