/* -------------------------------------------------------------------------- */
/*  Academy Lesson Data                                                        */
/*  Long-form educational content for the /learn/academy series.               */
/*  Parallel to blog-posts.ts but with different editorial conventions:        */
/*  lessons are tutorial-shaped (3000-5000 words), citation-heavy, and built   */
/*  to stand alone as SEO entry points.                                        */
/* -------------------------------------------------------------------------- */

// Markdown bodies are imported as raw strings via a webpack `asset/source`
// rule scoped to `src/lib/academy-bodies` (see next.config.ts). The content
// is inlined into the bundle at build time, so no runtime fs access is
// needed.
import PRICING_YOUR_MCP_SERVER_BODY from './academy-bodies/pricing-your-mcp-server.md'

export interface AcademyLessonAuthor {
  name: string
  url?: string
  bio: string
}

export interface AcademyLesson {
  slug: string
  title: string
  summary: string
  datePublished: string
  dateModified: string
  keywords: string[]
  readingTime: string
  /**
   * Optional override for the word-count shown in the article schema.
   * If absent, the page renderer computes it from the body markdown.
   */
  wordCount?: number
  author: AcademyLessonAuthor
  /** Markdown body — GFM with shiki-highlighted code fences. */
  body: string
  /**
   * OG image path served from /public. Optional; the renderer falls
   * back to the site-wide OG image when absent.
   */
  ogImage?: string
  /** Absolute canonical URL. Used for <link rel="canonical"> + OG url. */
  canonicalUrl: string
  /** Other lesson slugs to surface at the bottom of the page. */
  relatedSlugs: string[]
}

export const ACADEMY_LESSONS: AcademyLesson[] = [
  {
    slug: 'pricing-your-mcp-server',
    title: 'How to Price Your MCP Server: A Practical Guide',
    summary:
      'A step-by-step framework for pricing an MCP server in 2026. Calculate your cost floor, pick the right model (per-call, subscription, tiered, freemium, outcome-based), benchmark against OpenAI, Anthropic, and Stripe, and avoid the psychological traps that lead to underpricing.',
    datePublished: '2026-04-20',
    dateModified: '2026-04-20',
    keywords: [
      'how to price mcp server',
      'mcp server pricing',
      'ai tool pricing',
      'per-call billing pricing',
      'mcp monetization pricing',
      'ai api pricing benchmarks',
      'freemium mcp',
    ],
    readingTime: '14 min read',
    author: {
      name: 'SettleGrid Team',
      url: 'https://settlegrid.ai/about',
      bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
    },
    body: PRICING_YOUR_MCP_SERVER_BODY,
    canonicalUrl: 'https://settlegrid.ai/learn/academy/pricing-your-mcp-server',
    relatedSlugs: [],
  },
]

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

export const ACADEMY_SLUGS = ACADEMY_LESSONS.map((l) => l.slug)

export function getAcademyLessonBySlug(
  slug: string,
): AcademyLesson | undefined {
  return ACADEMY_LESSONS.find((l) => l.slug === slug)
}
