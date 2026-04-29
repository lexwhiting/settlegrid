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
import PER_CALL_VS_SUBSCRIPTION_BODY from './academy-bodies/per-call-vs-subscription.md'
import STRIPE_VS_SETTLEGRID_VS_X402_BODY from './academy-bodies/stripe-vs-settlegrid-vs-x402.md'
import ECONOMICS_OF_TOOL_CALLING_BODY from './academy-bodies/economics-of-tool-calling.md'
import CALCULATE_MARGIN_ON_AI_API_BODY from './academy-bodies/calculate-margin-on-ai-api.md'

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

const SHARED_AUTHOR: AcademyLessonAuthor = {
  name: 'SettleGrid Team',
  url: 'https://settlegrid.ai/about',
  bio: 'The SettleGrid team builds billing infrastructure for the MCP ecosystem, enabling developers to monetize AI tools with two lines of code.',
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
    author: SHARED_AUTHOR,
    body: PRICING_YOUR_MCP_SERVER_BODY,
    canonicalUrl: 'https://settlegrid.ai/learn/academy/pricing-your-mcp-server',
    relatedSlugs: [
      'per-call-vs-subscription',
      'economics-of-tool-calling',
      'calculate-margin-on-ai-api',
    ],
  },
  {
    slug: 'per-call-vs-subscription',
    title: 'Per-Call vs Subscription for AI Tools: A Decision Framework',
    summary:
      'When each pricing model wins, when hybrid models make sense, and how to migrate between them without breaking existing callers. Grounded in three case studies from the MCP ecosystem.',
    datePublished: '2026-04-20',
    dateModified: '2026-04-20',
    keywords: [
      'per-call vs subscription',
      'ai tool pricing model',
      'mcp subscription pricing',
      'usage-based vs subscription',
      'ai api pricing model',
      'hybrid pricing model',
      'subscription with overage',
    ],
    readingTime: '13 min read',
    author: SHARED_AUTHOR,
    body: PER_CALL_VS_SUBSCRIPTION_BODY,
    canonicalUrl: 'https://settlegrid.ai/learn/academy/per-call-vs-subscription',
    relatedSlugs: [
      'pricing-your-mcp-server',
      'stripe-vs-settlegrid-vs-x402',
      'economics-of-tool-calling',
    ],
  },
  {
    slug: 'stripe-vs-settlegrid-vs-x402',
    title:
      'Stripe MCP vs SettleGrid vs x402: How to Pick the Right Payment Rail',
    summary:
      'Three options developers often compare as competitors are actually solving different problems at different layers. This lesson clarifies what each is, where the overlaps and complements sit, and how to pick among them based on caller base and team capacity. Every competitor claim is cited from public sources.',
    datePublished: '2026-04-20',
    dateModified: '2026-04-20',
    keywords: [
      'stripe mpp',
      'stripe machine payments protocol',
      'x402 payment protocol',
      'agent payment rail',
      'pick the right payment rail',
      'mcp payment protocol comparison',
      'settlegrid vs stripe',
      'settlegrid vs x402',
    ],
    readingTime: '13 min read',
    author: SHARED_AUTHOR,
    body: STRIPE_VS_SETTLEGRID_VS_X402_BODY,
    canonicalUrl:
      'https://settlegrid.ai/learn/academy/stripe-vs-settlegrid-vs-x402',
    relatedSlugs: [
      'pricing-your-mcp-server',
      'per-call-vs-subscription',
      'economics-of-tool-calling',
    ],
  },
  {
    slug: 'economics-of-tool-calling',
    title: 'The Economics of Tool Calling: Where Margin Lives and Dies',
    summary:
      'How margin actually works in the three-layer agent-to-tool-to-infrastructure stack. Where margin gets compressed, the four economic levers that matter (batching, caching, tier selection, quality gating), and a worked P&L example at three revenue scales.',
    datePublished: '2026-04-20',
    dateModified: '2026-04-20',
    keywords: [
      'economics of tool calling',
      'ai tool unit economics',
      'mcp tool margin',
      'agent tool cost structure',
      'tool calling p&l',
      'ai api contribution margin',
      'inference cost optimization',
    ],
    readingTime: '14 min read',
    author: SHARED_AUTHOR,
    body: ECONOMICS_OF_TOOL_CALLING_BODY,
    canonicalUrl:
      'https://settlegrid.ai/learn/academy/economics-of-tool-calling',
    relatedSlugs: [
      'pricing-your-mcp-server',
      'calculate-margin-on-ai-api',
      'per-call-vs-subscription',
    ],
  },
  {
    slug: 'calculate-margin-on-ai-api',
    title: 'How to Calculate Margin on an AI API: Three Worked Examples',
    summary:
      'A practical guide to calculating per-call and per-caller margin for AI APIs. Three worked examples covering LLM wrappers, paid-upstream-API wrappers, and compute-only tools. Benchmarks by category, tracking cadence, and when low margin is actually acceptable.',
    datePublished: '2026-04-20',
    dateModified: '2026-04-20',
    keywords: [
      'how to calculate margin on an ai api',
      'calculate margin ai api',
      'ai api margin',
      'mcp tool margin calculation',
      'per-call margin',
      'contribution margin ai',
      'ai api unit economics',
      'ai api cost accounting',
    ],
    readingTime: '13 min read',
    author: SHARED_AUTHOR,
    body: CALCULATE_MARGIN_ON_AI_API_BODY,
    canonicalUrl:
      'https://settlegrid.ai/learn/academy/calculate-margin-on-ai-api',
    relatedSlugs: [
      'economics-of-tool-calling',
      'pricing-your-mcp-server',
      'per-call-vs-subscription',
    ],
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
