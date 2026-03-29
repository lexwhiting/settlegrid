/**
 * Tool Bundles & Cross-Reference Engine for SettleGrid.
 *
 * Creates network effects by recommending tools that work well together.
 * This is a data moat — competitors would need to replicate SettleGrid's
 * cross-ecosystem knowledge graph to offer similar recommendations.
 *
 * Bundles are defined by:
 * 1. Curated bundles (editorial, high-quality)
 * 2. Category affinity (tools in complementary categories)
 * 3. Ecosystem affinity (tools from different ecosystems that solve the same problem)
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ToolBundle {
  slug: string
  title: string
  description: string
  /** Category slugs of tools that belong in this bundle */
  categoryAffinities: string[]
  /** Ecosystem slugs that are preferred for this bundle */
  ecosystemAffinities: string[]
  /** Use-case keyword for matching tools by description */
  keywords: string[]
  /** Suggested combined discount percentage (e.g., 10 = 10% off) */
  suggestedDiscountPct: number
}

export interface CategoryAffinity {
  /** The source category */
  from: string
  /** Categories that complement the source */
  complements: ReadonlyArray<string>
  /** Reason for affinity (helps generate "why these work together" text) */
  reason: string
}

// ─── Curated Bundles ────────────────────────────────────────────────────────

export const TOOL_BUNDLES: ReadonlyArray<ToolBundle> = [
  {
    slug: 'rag-pipeline',
    title: 'RAG Pipeline Bundle',
    description:
      'Everything you need for retrieval-augmented generation: embeddings, vector search, LLM inference, and document processing. Save on the complete pipeline.',
    categoryAffinities: ['search', 'llm-inference', 'data', 'nlp'],
    ecosystemAffinities: ['huggingface', 'pypi', 'npm'],
    keywords: ['rag', 'retrieval', 'embedding', 'vector', 'search', 'langchain', 'llm'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'ai-coding-assistant',
    title: 'AI Coding Assistant Bundle',
    description:
      'Build a complete AI coding assistant: code analysis, linting, testing, and LLM-powered code generation. All with per-call billing.',
    categoryAffinities: ['code', 'llm-inference', 'search'],
    ecosystemAffinities: ['github', 'npm', 'pypi'],
    keywords: ['code', 'linting', 'analysis', 'copilot', 'codegen', 'testing'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'content-generation',
    title: 'Content Generation Bundle',
    description:
      'Create multimodal content: text generation, image creation, audio synthesis, and video processing. One billing layer for all media types.',
    categoryAffinities: ['media-generation', 'media', 'llm-inference', 'image'],
    ecosystemAffinities: ['replicate', 'huggingface'],
    keywords: ['generate', 'image', 'audio', 'video', 'content', 'creative', 'diffusion'],
    suggestedDiscountPct: 15,
  },
  {
    slug: 'data-enrichment',
    title: 'Data Enrichment Bundle',
    description:
      'Enrich raw data with company intel, geolocation, contact details, and market data. Per-lookup pricing across multiple data providers.',
    categoryAffinities: ['data', 'search', 'analytics', 'finance'],
    ecosystemAffinities: ['apify', 'npm', 'pypi'],
    keywords: ['enrich', 'data', 'company', 'geolocation', 'contact', 'lookup', 'scraping'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'security-audit',
    title: 'Security Audit Bundle',
    description:
      'Complete security toolkit: vulnerability scanning, threat intelligence, compliance checks, and SSL verification. Per-scan pricing.',
    categoryAffinities: ['security', 'code', 'data'],
    ecosystemAffinities: ['github', 'npm'],
    keywords: ['security', 'vulnerability', 'threat', 'compliance', 'audit', 'scan'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'browser-scraping',
    title: 'Browser Automation & Scraping Bundle',
    description:
      'Full web automation: browser control, data extraction, page rendering, and content parsing. Per-page billing for the complete scraping pipeline.',
    categoryAffinities: ['browser-automation', 'data', 'nlp'],
    ecosystemAffinities: ['apify', 'npm', 'pypi'],
    keywords: ['browser', 'scraping', 'automation', 'extract', 'crawl', 'playwright'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'financial-analysis',
    title: 'Financial Analysis Bundle',
    description:
      'Market data, financial analysis, and trading tools: real-time quotes, fundamental data, risk analysis, and portfolio optimization.',
    categoryAffinities: ['finance', 'data', 'analytics'],
    ecosystemAffinities: ['pypi', 'npm'],
    keywords: ['finance', 'market', 'stock', 'trading', 'portfolio', 'risk', 'crypto'],
    suggestedDiscountPct: 10,
  },
  {
    slug: 'nlp-processing',
    title: 'NLP Processing Bundle',
    description:
      'Complete text processing pipeline: entity extraction, sentiment analysis, translation, summarization, and text classification.',
    categoryAffinities: ['nlp', 'llm-inference', 'search'],
    ecosystemAffinities: ['huggingface', 'pypi'],
    keywords: ['nlp', 'text', 'sentiment', 'translation', 'entity', 'classification'],
    suggestedDiscountPct: 10,
  },
]

// ─── Category Affinity Graph ────────────────────────────────────────────────

export const CATEGORY_AFFINITIES: ReadonlyArray<CategoryAffinity> = [
  { from: 'nlp', complements: ['llm-inference', 'search', 'data', 'communication'], reason: 'NLP tools enhance LLM outputs and search quality' },
  { from: 'image', complements: ['media-generation', 'llm-inference', 'data'], reason: 'Vision tools complement generation and multimodal AI' },
  { from: 'code', complements: ['llm-inference', 'security', 'search'], reason: 'Code tools enhance AI coding assistants' },
  { from: 'data', complements: ['analytics', 'search', 'nlp', 'finance'], reason: 'Data tools feed analytics and search pipelines' },
  { from: 'search', complements: ['nlp', 'data', 'llm-inference'], reason: 'Search tools power RAG and retrieval workflows' },
  { from: 'finance', complements: ['data', 'analytics', 'security'], reason: 'Financial tools need data feeds and compliance checking' },
  { from: 'security', complements: ['code', 'data', 'communication'], reason: 'Security tools protect code and communication channels' },
  { from: 'media', complements: ['media-generation', 'nlp', 'image'], reason: 'Media processing feeds generation and analysis' },
  { from: 'communication', complements: ['nlp', 'productivity', 'analytics'], reason: 'Communication tools benefit from NLP and tracking' },
  { from: 'productivity', complements: ['communication', 'data', 'analytics'], reason: 'Productivity tools integrate with data and comms' },
  { from: 'analytics', complements: ['data', 'finance', 'productivity'], reason: 'Analytics needs data sources and feeds insights back' },
  { from: 'llm-inference', complements: ['nlp', 'search', 'code', 'media-generation'], reason: 'LLMs power all downstream AI capabilities' },
  { from: 'browser-automation', complements: ['data', 'nlp', 'search'], reason: 'Scraping feeds data pipelines and search indices' },
  { from: 'media-generation', complements: ['media', 'image', 'llm-inference'], reason: 'Generation tools work with processing and LLMs' },
]

/**
 * Returns complementary categories for a given category slug.
 * Used for "Tools that work well with this one" recommendations.
 */
export function getComplementaryCategories(categorySlug: string): ReadonlyArray<string> {
  const affinity = CATEGORY_AFFINITIES.find((a) => a.from === categorySlug)
  return affinity?.complements ?? []
}

/**
 * Returns bundles that match a given category slug.
 * A tool in category X will be recommended bundles that include X.
 */
export function getBundlesForCategory(categorySlug: string): ReadonlyArray<ToolBundle> {
  return TOOL_BUNDLES.filter((bundle) =>
    bundle.categoryAffinities.includes(categorySlug),
  )
}

/**
 * Returns bundles that match a given ecosystem.
 */
export function getBundlesForEcosystem(ecosystem: string): ReadonlyArray<ToolBundle> {
  return TOOL_BUNDLES.filter((bundle) =>
    bundle.ecosystemAffinities.includes(ecosystem),
  )
}

/**
 * Scores how well a tool description matches a bundle based on keyword overlap.
 * Returns a score between 0 and 1.
 */
export function scoreBundleMatch(
  toolDescription: string,
  bundle: ToolBundle,
): number {
  if (!toolDescription) return 0
  const lower = toolDescription.toLowerCase()
  let matchCount = 0
  for (const keyword of bundle.keywords) {
    if (lower.includes(keyword)) {
      matchCount++
    }
  }
  if (bundle.keywords.length === 0) return 0
  return matchCount / bundle.keywords.length
}

export const BUNDLE_SLUGS = TOOL_BUNDLES.map((b) => b.slug)
