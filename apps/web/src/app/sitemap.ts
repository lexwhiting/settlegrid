import type { MetadataRoute } from 'next'
import { CATEGORY_SLUGS } from '@/lib/categories'
import { SOLUTION_SLUGS } from '@/lib/solutions'
import { COLLECTION_SLUGS } from '@/lib/collections'
import { HOWTO_SLUGS } from '@/lib/howto-guides'
import { BLOG_SLUGS } from '@/lib/blog-posts'
import { INTEGRATION_SLUGS } from '@/lib/integration-guides'
import { FRAMEWORK_SLUGS } from '@/lib/frameworks'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { logger } from '@/lib/logger'

const BASE_URL = 'https://settlegrid.ai'

/** Regenerate sitemap hourly via ISR */
export const revalidate = 3600

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()

  // ── Dynamic tool pages from DB ────────────────────────────────────────────
  let toolEntries: MetadataRoute.Sitemap = []
  try {
    const activeTools = await db
      .select({ slug: tools.slug, updatedAt: tools.updatedAt })
      .from(tools)
      .where(eq(tools.status, 'active'))
      .limit(50000)

    toolEntries = activeTools.map((tool) => ({
      url: `${BASE_URL}/tools/${tool.slug}`,
      lastModified: tool.updatedAt ?? now,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    }))
  } catch (err) {
    // Graceful degradation: if DB is unreachable, still serve static entries
    logger.warn('sitemap.db_query_failed', {
      error: err instanceof Error ? err.message : String(err),
    })
  }

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
    ...(['mcp', 'mpp', 'x402', 'ap2', 'visa-tap', 'ucp', 'acp', 'mastercard-agent-pay', 'circle-nanopayments', 'rest', 'l402', 'alipay-trust', 'kyapay', 'emvco', 'drain'] as const).map(
      (slug) => ({
        url: `${BASE_URL}/learn/protocols/${slug}`,
        lastModified: now,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })
    ),
    {
      url: `${BASE_URL}/learn/glossary`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Standalone pages ─────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/use-cases`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/changelog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Solutions pages ─────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/solutions`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...SOLUTION_SLUGS.map((slug) => ({
      url: `${BASE_URL}/solutions/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // ── Explore pages (programmatic SEO) ─────────────────────────────────────
    {
      url: `${BASE_URL}/explore`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    ...CATEGORY_SLUGS.map((cat) => ({
      url: `${BASE_URL}/explore/category/${cat}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // ── Curated collections ─────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/explore/collections`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...COLLECTION_SLUGS.map((slug) => ({
      url: `${BASE_URL}/explore/collections/${slug}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // ── Framework integration pages ──────────────────────────────────────────
    ...FRAMEWORK_SLUGS.map((fw) => ({
      url: `${BASE_URL}/explore/for/${fw}`,
      lastModified: now,
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    })),

    // ── Marketplace ────────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/marketplace`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    ...(['mcp-servers', 'ai-models', 'apis', 'agent-tools', 'packages', 'automations', 'datasets', 'extensions'] as const).map(
      (type) => ({
        url: `${BASE_URL}/marketplace/${type}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.8,
      })
    ),
    ...(['huggingface', 'npm', 'pypi', 'smithery', 'apify', 'mcp-registry', 'pulsemcp', 'replicate', 'openrouter', 'github'] as const).map(
      (eco) => ({
        url: `${BASE_URL}/marketplace/ecosystem/${eco}`,
        lastModified: now,
        changeFrequency: 'daily' as const,
        priority: 0.7,
      })
    ),


    // ── How-to guides ─────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn/how-to`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...HOWTO_SLUGS.map((slug) => ({
      url: `${BASE_URL}/learn/how-to/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // ── Framework integrations ────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn/integrations`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...INTEGRATION_SLUGS.map((slug) => ({
      url: `${BASE_URL}/learn/integrations/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

    // ── GitHub App ──────────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn/github-app`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },

    // ── Content pages & blog ──────────────────────────────────────────────────
    {
      url: `${BASE_URL}/learn/state-of-mcp-2026`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/learn/mcp-zero-problem`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    ...BLOG_SLUGS.map((slug) => ({
      url: `${BASE_URL}/learn/blog/${slug}`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),

    // ── Monetization guides ───────────────────────────────────────────────────
    {
      url: `${BASE_URL}/guides`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    ...CATEGORY_SLUGS.map((cat) => ({
      url: `${BASE_URL}/guides/monetize-${cat}-tools`,
      lastModified: now,
      changeFrequency: 'monthly' as const,
      priority: 0.6,
    })),

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
    // ── Marketplace data APIs ─────────────────────────────────────────────
    {
      url: `${BASE_URL}/api/marketplace/stats`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/api/marketplace/bundles`,
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

    // ── Dynamic tool detail pages ──────────────────────────────────────────
    ...toolEntries,
  ]
}
