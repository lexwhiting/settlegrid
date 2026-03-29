/**
 * Universal AI Tool Crawlers for SettleGrid.
 *
 * Crawls multiple ecosystems beyond MCP registries to discover AI tools,
 * models, APIs, agents, and SDK packages for the universal AI settlement
 * catalog. Each crawler handles errors gracefully (returns empty array on
 * failure), uses a 10-second fetch timeout, and returns normalized
 * CrawledService entries.
 */

import { logger } from '@/lib/logger'
import { getGitHubToken } from '@/lib/env'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface CrawledServiceEnrichment {
  /** Download/install/run count from the source registry */
  popularityCount?: number
  /** Stars (GitHub) or likes (HuggingFace) */
  starCount?: number
  /** ISO date string of last update from the source registry */
  lastUpdatedAt?: string
  /** License identifier (e.g. 'MIT', 'Apache-2.0') */
  license?: string
  /** Number of maintainers/contributors */
  maintainerCount?: number
  /** Whether this tool is already monetized elsewhere (paid API, SaaS tier, etc.) */
  isAlreadyMonetized?: boolean
  /** Where it is monetized, if detected (e.g. 'replicate', 'huggingface-pro', 'npm-paid') */
  monetizationSource?: string
  /** Auto-detected category slug from keyword analysis */
  detectedCategory?: string
  /** Confidence of the category detection (0-1) */
  categoryConfidence?: number
  /** Detected pricing info from the source (cents per call, if available) */
  detectedPriceCents?: number
  /** Pricing model detected from source ('per-run', 'per-token', 'subscription', 'free') */
  detectedPricingModel?: string
  /** Repository language (e.g. 'Python', 'TypeScript') */
  language?: string
  /** Tags extracted from the source registry */
  sourceTags?: string[]
}

export interface CrawledService {
  name: string
  description: string
  sourceUrl: string
  source: string
  toolType: string
  authorEmail?: string
  /** Rich metadata for data moat — makes SettleGrid's directory more valuable than source registries */
  enrichment?: CrawledServiceEnrichment
}

// ─── Constants ──────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 10_000
const USER_AGENT = 'SettleGrid-Crawler/1.0 (https://settlegrid.ai)'

/** All universal sources in rotation order */
export const UNIVERSAL_SOURCES = [
  'huggingface-models',
  'huggingface-spaces',
  'apify',
  'pypi',
  'replicate',
  'npm-ai',
  'github',
] as const

export type UniversalSource = (typeof UNIVERSAL_SOURCES)[number]

// ─── Keyword-based category classifier ─────────────────────────────────────

/** Maps keyword patterns to category slugs with confidence weights */
const CATEGORY_KEYWORD_MAP: ReadonlyArray<{
  category: string
  keywords: ReadonlyArray<string>
  weight: number
}> = [
  { category: 'nlp', keywords: ['nlp', 'text', 'language', 'sentiment', 'translation', 'summariz', 'tokeniz', 'embedding', 'ner', 'chatbot', 'conversational'], weight: 0.85 },
  { category: 'image', keywords: ['image', 'vision', 'ocr', 'object-detection', 'segmentation', 'diffusion', 'stable-diffusion', 'dalle', 'midjourney', 'img2img', 'inpainting'], weight: 0.85 },
  { category: 'code', keywords: ['code', 'linting', 'formatter', 'compiler', 'ast', 'refactor', 'copilot', 'codegen', 'lint', 'typescript', 'python'], weight: 0.8 },
  { category: 'data', keywords: ['data', 'database', 'sql', 'csv', 'json', 'api', 'scraping', 'crawl', 'etl', 'pipeline', 'warehouse'], weight: 0.75 },
  { category: 'search', keywords: ['search', 'retrieval', 'rag', 'vector', 'semantic', 'index', 'query', 'elasticsearch', 'pinecone', 'weaviate'], weight: 0.85 },
  { category: 'finance', keywords: ['finance', 'trading', 'stock', 'crypto', 'payment', 'invoice', 'accounting', 'forex', 'defi', 'blockchain'], weight: 0.85 },
  { category: 'science', keywords: ['science', 'research', 'molecule', 'chemistry', 'physics', 'biology', 'genome', 'protein', 'arxiv', 'pubmed'], weight: 0.85 },
  { category: 'media', keywords: ['audio', 'video', 'music', 'speech', 'tts', 'stt', 'transcri', 'podcast', 'voice', 'sound', 'whisper'], weight: 0.85 },
  { category: 'security', keywords: ['security', 'vulnerability', 'threat', 'malware', 'firewall', 'encryption', 'ssl', 'pentest', 'compliance'], weight: 0.85 },
  { category: 'communication', keywords: ['email', 'sms', 'notification', 'messaging', 'chat', 'slack', 'discord', 'webhook', 'push'], weight: 0.8 },
  { category: 'productivity', keywords: ['productivity', 'calendar', 'task', 'workflow', 'automation', 'scheduling', 'document', 'pdf', 'spreadsheet'], weight: 0.75 },
  { category: 'analytics', keywords: ['analytics', 'dashboard', 'metrics', 'monitoring', 'observability', 'logging', 'tracing', 'apm'], weight: 0.8 },
  { category: 'llm-inference', keywords: ['llm', 'gpt', 'claude', 'gemini', 'mistral', 'inference', 'transformer', 'attention', 'fine-tun'], weight: 0.9 },
  { category: 'browser-automation', keywords: ['browser', 'playwright', 'puppeteer', 'selenium', 'headless', 'scraper', 'crawler'], weight: 0.85 },
  { category: 'media-generation', keywords: ['generate', 'generation', 'text-to-image', 'text-to-speech', 'text-to-video', 'elevenlabs', 'suno'], weight: 0.8 },
]

/**
 * Classifies a tool into a category based on keyword analysis of its
 * name, description, and source tags. Returns the best matching category
 * with confidence score. This is a local, zero-cost alternative to AI
 * classification that runs on every crawled tool.
 */
export function classifyByKeywords(
  name: string,
  description: string,
  tags: string[] = [],
): { category: string; confidence: number } | null {
  const combined = `${name} ${description} ${tags.join(' ')}`.toLowerCase()
  let bestCategory: string | null = null
  let bestScore = 0

  for (const entry of CATEGORY_KEYWORD_MAP) {
    let matchCount = 0
    for (const keyword of entry.keywords) {
      if (combined.includes(keyword)) {
        matchCount++
      }
    }
    if (matchCount === 0) continue

    // Score = (matched keywords / total keywords) * weight
    const score = (matchCount / entry.keywords.length) * entry.weight
    if (score > bestScore) {
      bestScore = score
      bestCategory = entry.category
    }
  }

  if (!bestCategory || bestScore < 0.05) return null

  return {
    category: bestCategory,
    confidence: Math.min(bestScore, 1),
  }
}

// ─── Monetization detection patterns ────────────────────────────────────────

/** URL patterns that indicate a tool is already monetized */
const MONETIZATION_INDICATORS: ReadonlyArray<{
  pattern: RegExp
  source: string
}> = [
  { pattern: /replicate\.com\//, source: 'replicate' },
  { pattern: /api\.openai\.com/, source: 'openai' },
  { pattern: /rapidapi\.com\//, source: 'rapidapi' },
  { pattern: /aws\.amazon\.com\/marketplace/, source: 'aws-marketplace' },
  { pattern: /cloud\.google\.com\/marketplace/, source: 'gcp-marketplace' },
  { pattern: /azuremarketplace\.microsoft\.com/, source: 'azure-marketplace' },
]

/** Description patterns that suggest existing monetization */
const PAID_DESCRIPTION_PATTERNS: ReadonlyArray<RegExp> = [
  /\bpaid\b/i,
  /\bpro plan\b/i,
  /\bsubscription\b/i,
  /\bpricing\b/i,
  /\$\d+/,
  /\bper[- ]month\b/i,
  /\bfree tier\b/i,
  /\bapi key required\b/i,
]

/**
 * Detects whether a tool is already monetized elsewhere based on
 * URL patterns and description text analysis.
 */
export function detectMonetization(
  sourceUrl: string,
  description: string,
): { isMonetized: boolean; source?: string } {
  // Check URL patterns
  for (const indicator of MONETIZATION_INDICATORS) {
    if (indicator.pattern.test(sourceUrl)) {
      return { isMonetized: true, source: indicator.source }
    }
  }

  // Check description for pricing language
  for (const pattern of PAID_DESCRIPTION_PATTERNS) {
    if (pattern.test(description)) {
      return { isMonetized: true, source: 'description-detected' }
    }
  }

  return { isMonetized: false }
}

// ─── Pricing detection from descriptions ────────────────────────────────────

/** Patterns to extract pricing info from descriptions */
const PRICE_PATTERNS: ReadonlyArray<{
  pattern: RegExp
  model: string
}> = [
  { pattern: /\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:call|request|invocation|query)/i, model: 'per-invocation' },
  { pattern: /\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:1[kK]|1000)\s*(?:token|tok)/i, model: 'per-token' },
  { pattern: /\$(\d+(?:\.\d+)?)\s*(?:per|\/)\s*(?:run|prediction|inference)/i, model: 'per-run' },
  { pattern: /(\d+(?:\.\d+)?)\s*(?:cent|c)\s*(?:per|\/)\s*(?:call|request)/i, model: 'per-invocation' },
]

/**
 * Attempts to extract pricing information from a tool's description text.
 * Returns detected price in cents and pricing model, or null if not found.
 */
export function detectPricingFromDescription(
  description: string,
): { priceCents: number; model: string } | null {
  for (const { pattern, model } of PRICE_PATTERNS) {
    const match = description.match(pattern)
    if (match?.[1]) {
      const value = parseFloat(match[1])
      if (Number.isFinite(value) && value > 0 && value < 10000) {
        // If the pattern matched dollars, convert to cents
        const isCents = pattern.source.includes('cent')
        const cents = isCents ? Math.round(value) : Math.round(value * 100)
        return { priceCents: cents, model }
      }
    }
  }
  return null
}

// ─── Fetch helper ───────────────────────────────────────────────────────────

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json',
        ...options.headers,
      },
    })
  } finally {
    clearTimeout(timeout)
  }
}

// ─── Source 1: HuggingFace Models ───────────────────────────────────────────

const HF_MODELS_URL = 'https://huggingface.co/api/models'

/** Minimum download threshold to filter low-quality models */
const HF_MIN_DOWNLOADS = 1000

interface HfModel {
  id?: string
  pipeline_tag?: string
  downloads?: number
  author?: string
  modelId?: string
  likes?: number
  lastModified?: string
  tags?: string[]
  library_name?: string
  gated?: boolean | string
}

/**
 * Crawls HuggingFace for popular models sorted by downloads.
 * Filters to models with >1000 downloads.
 */
export async function crawlHuggingFaceModels(limit: number): Promise<CrawledService[]> {
  try {
    const url = new URL(HF_MODELS_URL)
    url.searchParams.set('sort', 'downloads')
    url.searchParams.set('direction', '-1')
    url.searchParams.set('limit', String(Math.min(limit * 2, 200)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.hf_models.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (!Array.isArray(data)) {
      logger.warn('crawler.hf_models.unexpected_format', { msg: 'Expected array response' })
      return []
    }

    const results: CrawledService[] = []

    for (const raw of data) {
      if (results.length >= limit) break
      if (typeof raw !== 'object' || raw === null) continue

      const model = raw as HfModel

      const id = typeof model.id === 'string' ? model.id.trim() : ''
      if (!id) continue

      const downloads =
        typeof model.downloads === 'number' && Number.isFinite(model.downloads)
          ? model.downloads
          : 0

      // Filter: only include models with significant usage
      if (downloads < HF_MIN_DOWNLOADS) continue

      const author = typeof model.author === 'string' ? model.author : id.split('/')[0] ?? 'unknown'
      const pipelineTag = typeof model.pipeline_tag === 'string' ? model.pipeline_tag : ''
      const modelName = id.includes('/') ? id.split('/').slice(1).join('/') : id

      const descParts = [
        pipelineTag ? `[${pipelineTag}]` : '',
        `Model by ${author}.`,
        `${downloads.toLocaleString()} downloads.`,
      ].filter(Boolean)

      // Enrichment: extract metadata that makes SettleGrid's directory richer
      const tags: string[] = Array.isArray(model.tags)
        ? model.tags.filter((t): t is string => typeof t === 'string')
        : []
      const likes = typeof model.likes === 'number' && Number.isFinite(model.likes) ? model.likes : 0
      const lastModified = typeof model.lastModified === 'string' ? model.lastModified : undefined
      const libraryName = typeof model.library_name === 'string' ? model.library_name : undefined
      const isGated = model.gated === true || model.gated === 'auto' || model.gated === 'manual'

      const fullDesc = `${modelName}: ${descParts.join(' ')}`.slice(0, 2000)
      const categoryResult = classifyByKeywords(modelName, fullDesc, tags.concat(pipelineTag ? [pipelineTag] : []))
      const monetization = detectMonetization(`https://huggingface.co/${id}`, fullDesc)
      const pricingInfo = detectPricingFromDescription(fullDesc)

      results.push({
        name: `hf-model-${id.replace('/', '-')}`,
        description: fullDesc,
        sourceUrl: `https://huggingface.co/${id}`,
        source: 'huggingface',
        toolType: 'ai-model',
        enrichment: {
          popularityCount: downloads,
          starCount: likes,
          lastUpdatedAt: lastModified,
          sourceTags: tags.slice(0, 20),
          language: libraryName,
          isAlreadyMonetized: isGated || monetization.isMonetized,
          monetizationSource: isGated ? 'huggingface-gated' : monetization.source,
          detectedCategory: categoryResult?.category,
          categoryConfidence: categoryResult?.confidence,
          detectedPriceCents: pricingInfo?.priceCents,
          detectedPricingModel: pricingInfo?.model,
        },
      })
    }

    logger.info('crawler.hf_models.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.hf_models.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 2: HuggingFace Spaces ───────────────────────────────────────────

const HF_SPACES_URL = 'https://huggingface.co/api/spaces'

/** Tags that indicate the space exposes an API or inference endpoint */
const SPACE_API_TAGS = new Set(['api', 'inference', 'gradio', 'fastapi', 'docker'])

interface HfSpace {
  id?: string
  author?: string
  cardData?: {
    title?: string
    short_description?: string
    tags?: string[]
  }
  tags?: string[]
  likes?: number
  sdk?: string
}

/**
 * Crawls HuggingFace Spaces sorted by likes, filtering for spaces
 * with API/inference tags.
 */
export async function crawlHuggingFaceSpaces(limit: number): Promise<CrawledService[]> {
  try {
    const url = new URL(HF_SPACES_URL)
    url.searchParams.set('sort', 'likes')
    url.searchParams.set('direction', '-1')
    url.searchParams.set('limit', String(Math.min(limit * 2, 200)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.hf_spaces.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (!Array.isArray(data)) {
      logger.warn('crawler.hf_spaces.unexpected_format', { msg: 'Expected array response' })
      return []
    }

    const results: CrawledService[] = []

    for (const raw of data) {
      if (results.length >= limit) break
      if (typeof raw !== 'object' || raw === null) continue

      const space = raw as HfSpace

      if (typeof space.id !== 'string' || space.id.trim().length === 0) continue

      // Collect all tags from both top-level and cardData
      const allTags: string[] = []
      if (Array.isArray(space.tags)) {
        for (const t of space.tags) {
          if (typeof t === 'string') allTags.push(t.toLowerCase())
        }
      }
      if (Array.isArray(space.cardData?.tags)) {
        for (const t of space.cardData.tags) {
          if (typeof t === 'string') allTags.push(t.toLowerCase())
        }
      }
      if (typeof space.sdk === 'string') {
        allTags.push(space.sdk.toLowerCase())
      }

      // Filter: must have at least one API/inference-related tag
      const hasApiTag = allTags.some((tag) => SPACE_API_TAGS.has(tag))
      if (!hasApiTag) continue

      const id = space.id.trim()
      const author = typeof space.author === 'string' ? space.author : id.split('/')[0] ?? 'unknown'
      const spaceName = id.includes('/') ? id.split('/').slice(1).join('/') : id

      const title =
        typeof space.cardData?.title === 'string' && space.cardData.title.trim().length > 0
          ? space.cardData.title.trim()
          : spaceName

      const shortDesc =
        typeof space.cardData?.short_description === 'string'
          ? space.cardData.short_description.trim()
          : ''
      const likes =
        typeof space.likes === 'number' && Number.isFinite(space.likes) ? space.likes : 0
      const descParts = [shortDesc, `By ${author}.`, `${likes.toLocaleString()} likes.`].filter(
        Boolean,
      )

      const fullDesc = `${title}: ${descParts.join(' ')}`.slice(0, 2000)
      const categoryResult = classifyByKeywords(title, fullDesc, allTags)
      const sdkName = typeof space.sdk === 'string' ? space.sdk : undefined

      results.push({
        name: `hf-${id.replace('/', '-')}`,
        description: fullDesc,
        sourceUrl: `https://huggingface.co/spaces/${id}`,
        source: 'huggingface',
        toolType: 'ai-model',
        enrichment: {
          starCount: likes,
          sourceTags: allTags.slice(0, 20),
          language: sdkName,
          detectedCategory: categoryResult?.category,
          categoryConfidence: categoryResult?.confidence,
        },
      })
    }

    logger.info('crawler.hf_spaces.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.hf_spaces.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 3: Apify Actors ─────────────────────────────────────────────────

const APIFY_STORE_URL = 'https://api.apify.com/v2/store'

interface ApifyItem {
  title?: string
  name?: string
  username?: string
  description?: string
  stats?: {
    totalRuns?: number
    totalUsers?: number
    totalBuilds?: number
  }
  currentPricingInfo?: {
    pricingModel?: string
  }
  categories?: string[]
  modifiedAt?: string
}

interface ApifyStoreResponse {
  data?: {
    items?: ApifyItem[]
  }
}

/**
 * Crawls the Apify Actor Store for popular automation actors.
 */
export async function crawlApifyActors(limit: number): Promise<CrawledService[]> {
  try {
    const url = new URL(APIFY_STORE_URL)
    url.searchParams.set('limit', String(Math.min(limit, 100)))
    url.searchParams.set('offset', '0')
    url.searchParams.set('sortBy', 'popularity')

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.apify.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      logger.warn('crawler.apify.unexpected_format', { msg: 'Expected object response' })
      return []
    }

    const response = data as ApifyStoreResponse

    // Apify returns { data: { items: [...] } }
    const items: unknown[] = Array.isArray(response.data?.items)
      ? response.data.items
      : []

    if (items.length === 0) {
      logger.info('crawler.apify.no_data', { msg: 'Store returned 0 actors' })
      return []
    }

    const results: CrawledService[] = []
    const seen = new Set<string>()

    for (const raw of items) {
      if (results.length >= limit) break
      if (typeof raw !== 'object' || raw === null) continue

      const item = raw as ApifyItem

      const title = typeof item.title === 'string' ? item.title.trim() : ''
      const name = typeof item.name === 'string' ? item.name.trim() : ''
      const username = typeof item.username === 'string' ? item.username.trim() : ''

      if (!name || !username) continue

      // Deduplicate by username/name
      const key = `${username}/${name}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const displayName = title || name
      const description = typeof item.description === 'string'
        ? item.description.trim().slice(0, 2000)
        : ''

      const fullDesc = `${displayName}: ${description}`.slice(0, 2000)
      const totalRuns = typeof item.stats?.totalRuns === 'number' ? item.stats.totalRuns : undefined
      const totalUsers = typeof item.stats?.totalUsers === 'number' ? item.stats.totalUsers : undefined
      const modifiedAt = typeof item.modifiedAt === 'string' ? item.modifiedAt : undefined
      const apifyCategories: string[] = Array.isArray(item.categories)
        ? item.categories.filter((c): c is string => typeof c === 'string')
        : []
      const isPaid = item.currentPricingInfo?.pricingModel === 'PRICE_PER_RUN'
        || item.currentPricingInfo?.pricingModel === 'FLAT_PRICE_PER_MONTH'

      const categoryResult = classifyByKeywords(displayName, fullDesc, apifyCategories)

      results.push({
        name: `apify-${username}-${name}`,
        description: fullDesc,
        sourceUrl: `https://apify.com/${username}/${name}`,
        source: 'apify',
        toolType: 'rest-api',
        enrichment: {
          popularityCount: totalRuns,
          maintainerCount: totalUsers !== undefined ? Math.min(totalUsers, 1) : undefined,
          lastUpdatedAt: modifiedAt,
          sourceTags: apifyCategories.slice(0, 20),
          isAlreadyMonetized: isPaid,
          monetizationSource: isPaid ? 'apify' : undefined,
          detectedCategory: categoryResult?.category,
          categoryConfidence: categoryResult?.confidence,
          detectedPricingModel: isPaid ? 'per-run' : undefined,
        },
      })
    }

    logger.info('crawler.apify.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.apify.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 4: PyPI AI Packages ─────────────────────────────────────────────

const PYPI_PACKAGE_URL = 'https://pypi.org/pypi'

/** Curated list of top AI/ML packages on PyPI */
const PYPI_AI_PACKAGES: readonly string[] = [
  // LLM providers & SDKs
  'langchain', 'transformers', 'torch', 'tensorflow', 'openai', 'anthropic',
  'replicate', 'together', 'fireworks-ai', 'cohere', 'huggingface-hub',
  // Diffusion & generation
  'diffusers', 'accelerate', 'datasets', 'tokenizers', 'sentence-transformers',
  // Vector databases
  'faiss-cpu', 'chromadb', 'pinecone-client', 'weaviate-client', 'qdrant-client',
  // Agent frameworks
  'llama-index', 'crewai', 'autogen', 'semantic-kernel', 'dspy',
  'instructor', 'pydantic-ai', 'guardrails-ai', 'guidance', 'outlines',
  // Inference & serving
  'vllm', 'litellm', 'langsmith',
  // MLOps & experiment tracking
  'wandb', 'mlflow', 'optuna', 'ray', 'dask',
  // App builders
  'streamlit', 'gradio', 'panel', 'plotly', 'dash',
  // Web frameworks (AI serving)
  'fastapi', 'flask', 'django',
  // Workflow orchestration
  'celery', 'prefect', 'dagster', 'airflow',
  // Cloud AI SDKs
  'boto3', 'google-cloud-aiplatform', 'azure-ai',
  // Media generation
  'stability-sdk', 'elevenlabs', 'assemblyai', 'deepgram-sdk',
  // Audio/speech
  'whisper', 'bark', 'tortoise-tts', 'coqui-tts', 'piper-tts',
  'speechbrain', 'pyannote-audio', 'nemo-toolkit',
  // NLP frameworks
  'paddlepaddle', 'paddlenlp', 'spacy', 'nltk', 'gensim',
  'flair', 'stanza', 'allennlp', 'fasttext', 'textblob',
  'pattern', 'polyglot', 'jieba',
  // Data labeling
  'snorkel', 'cleanlab', 'label-studio-sdk', 'prodigy', 'doccano', 'argilla',
  // Evaluation & observability
  'ragas', 'deepeval', 'promptfoo', 'phoenix-ai', 'langfuse', 'helicone', 'agentops',
  // Inference hosting
  'modal', 'banana-dev', 'baseten', 'cerebrium', 'pipeline-ai',
  'bentoml', 'truss', 'runpod', 'vast-ai', 'lambda-cloud',
] as const

interface PypiPackageInfo {
  info?: {
    name?: string
    summary?: string
    author_email?: string
    home_page?: string
    project_urls?: Record<string, string>
    license?: string
    keywords?: string
    classifiers?: string[]
    maintainer?: string
    maintainer_email?: string
    version?: string
    requires_dist?: string[]
  }
}

/**
 * Crawls PyPI for known AI packages by fetching metadata for each
 * package in the curated list. PyPI has no search API, so we check
 * individual package endpoints.
 */
export async function crawlPypiAiPackages(limit: number): Promise<CrawledService[]> {
  const results: CrawledService[] = []
  const packagesToCheck = PYPI_AI_PACKAGES.slice(0, Math.min(limit * 2, PYPI_AI_PACKAGES.length))

  for (const pkgName of packagesToCheck) {
    if (results.length >= limit) break

    try {
      const res = await fetchWithTimeout(`${PYPI_PACKAGE_URL}/${pkgName}/json`)
      if (!res.ok) {
        // Package may not exist or API may be throttling — skip silently
        continue
      }

      const data: unknown = await res.json()
      if (typeof data !== 'object' || data === null) continue

      const pkg = data as PypiPackageInfo
      const info = pkg.info
      if (!info || typeof info !== 'object') continue

      const name = typeof info.name === 'string' ? info.name.trim() : pkgName
      if (!name) continue

      const summary = typeof info.summary === 'string' ? info.summary.trim().slice(0, 2000) : ''
      const authorEmail = typeof info.author_email === 'string' ? info.author_email.trim() : undefined

      // Resolve source URL: prefer repository, then home_page
      const projectUrls = typeof info.project_urls === 'object' && info.project_urls !== null
        ? info.project_urls
        : {}
      const repoUrl =
        (typeof projectUrls.Repository === 'string' ? projectUrls.Repository : null) ??
        (typeof projectUrls.Source === 'string' ? projectUrls.Source : null) ??
        (typeof projectUrls.GitHub === 'string' ? projectUrls.GitHub : null) ??
        (typeof projectUrls.Homepage === 'string' ? projectUrls.Homepage : null) ??
        (typeof info.home_page === 'string' && info.home_page.length > 0
          ? info.home_page
          : `https://pypi.org/project/${name}/`)

      const license = typeof info.license === 'string' ? info.license.trim() : undefined
      const pypiKeywords = typeof info.keywords === 'string'
        ? info.keywords.split(',').map((k) => k.trim()).filter(Boolean)
        : []
      // Count maintainers from classifiers or email presence
      const hasMaintainer = typeof info.maintainer === 'string' && info.maintainer.length > 0
      const maintainerCount = hasMaintainer ? 2 : 1 // Author + optional maintainer

      const fullDesc = summary || `Python package: ${name}`
      const categoryResult = classifyByKeywords(name, fullDesc, pypiKeywords)
      const monetization = detectMonetization(repoUrl, fullDesc)

      results.push({
        name: `pypi-${name}`,
        description: fullDesc,
        sourceUrl: repoUrl,
        source: 'pypi',
        toolType: 'sdk-package',
        authorEmail: authorEmail || undefined,
        enrichment: {
          license: license || undefined,
          language: 'Python',
          maintainerCount,
          sourceTags: pypiKeywords.slice(0, 20),
          isAlreadyMonetized: monetization.isMonetized,
          monetizationSource: monetization.source,
          detectedCategory: categoryResult?.category,
          categoryConfidence: categoryResult?.confidence,
        },
      })
    } catch (err) {
      // Individual package failure — log and continue
      const isTimeout = err instanceof Error && err.name === 'AbortError'
      logger.warn('crawler.pypi.package_error', {
        package: pkgName,
        msg: isTimeout ? 'Timed out' : 'Fetch failed',
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  logger.info('crawler.pypi.completed', { count: results.length })
  return results
}

// ─── Source 5: Replicate Models ─────────────────────────────────────────────

const REPLICATE_API_URL = 'https://api.replicate.com/v1/models'

interface ReplicateModel {
  url?: string
  owner?: string
  name?: string
  description?: string
  run_count?: number
  github_url?: string
  visibility?: string
  latest_version?: {
    created_at?: string
  }
  default_example?: {
    completed_at?: string
  }
  cover_image_url?: string
}

interface ReplicateListResponse {
  results?: ReplicateModel[]
  next?: string
}

/**
 * Crawls Replicate for popular models sorted by run count.
 */
export async function crawlReplicateModels(limit: number): Promise<CrawledService[]> {
  try {
    const url = new URL(REPLICATE_API_URL)
    url.searchParams.set('page_size', String(Math.min(limit * 2, 100)))

    const res = await fetchWithTimeout(url.toString())
    if (!res.ok) {
      logger.warn('crawler.replicate.fetch_failed', { status: res.status })
      return []
    }

    const data: unknown = await res.json()
    if (typeof data !== 'object' || data === null) {
      logger.warn('crawler.replicate.unexpected_format', { msg: 'Expected object response' })
      return []
    }

    const response = data as ReplicateListResponse
    const models: unknown[] = Array.isArray(response.results)
      ? response.results
      : Array.isArray(data)
        ? (data as unknown[])
        : []

    if (models.length === 0) {
      logger.info('crawler.replicate.no_data', { msg: 'API returned 0 models' })
      return []
    }

    // Sort by run count descending
    const typed = models.filter(
      (m): m is ReplicateModel => typeof m === 'object' && m !== null,
    )
    typed.sort((a, b) => {
      const aRuns =
        typeof a.run_count === 'number' && Number.isFinite(a.run_count) ? a.run_count : 0
      const bRuns =
        typeof b.run_count === 'number' && Number.isFinite(b.run_count) ? b.run_count : 0
      return bRuns - aRuns
    })

    const results: CrawledService[] = []
    const seen = new Set<string>()

    for (const model of typed) {
      if (results.length >= limit) break

      const owner = typeof model.owner === 'string' ? model.owner.trim() : ''
      const name = typeof model.name === 'string' ? model.name.trim() : ''
      if (!owner || !name) continue

      const key = `${owner}/${name}`.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)

      const runCount =
        typeof model.run_count === 'number' && Number.isFinite(model.run_count)
          ? model.run_count
          : 0

      const rawDescription =
        typeof model.description === 'string' ? model.description.trim() : ''

      const descParts = [
        rawDescription,
        `By ${owner}.`,
        `${runCount.toLocaleString()} runs.`,
      ].filter(Boolean)

      const sourceUrl =
        typeof model.github_url === 'string' && model.github_url.length > 0
          ? model.github_url
          : typeof model.url === 'string' && model.url.length > 0
            ? model.url
            : `https://replicate.com/${owner}/${name}`

      const fullDesc = descParts.join(' ').slice(0, 2000)
      const categoryResult = classifyByKeywords(name, fullDesc)
      const lastVersion = model.latest_version?.created_at
      const lastUpdated = typeof lastVersion === 'string' ? lastVersion : undefined

      results.push({
        name: `replicate-${owner}-${name}`,
        description: fullDesc,
        sourceUrl,
        source: 'replicate',
        toolType: 'ai-model',
        enrichment: {
          popularityCount: runCount,
          lastUpdatedAt: lastUpdated,
          // Replicate models are always monetized (pay-per-prediction)
          isAlreadyMonetized: true,
          monetizationSource: 'replicate',
          detectedCategory: categoryResult?.category,
          categoryConfidence: categoryResult?.confidence,
          detectedPricingModel: 'per-run',
        },
      })
    }

    logger.info('crawler.replicate.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.replicate.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 6: npm AI Packages (expanded) ───────────────────────────────────

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search'

/** Expanded search queries covering the full AI ecosystem */
const NPM_AI_QUERIES = [
  'langchain tool',
  'crewai tool',
  'ai agent',
  'llm api',
  'openai plugin',
  'ai sdk',
  'machine learning api',
  'vector database',
  'embeddings',
  'text-to-speech',
  'image-generation ai',
  'ai middleware',
] as const

/** Max results per npm query (API caps at 250) */
const NPM_RESULTS_PER_QUERY = 50

interface NpmSearchObject {
  package?: {
    name?: string
    description?: string
    links?: {
      repository?: string
      homepage?: string
      npm?: string
    }
    keywords?: string[]
    publisher?: {
      email?: string
    }
  }
}

interface NpmSearchResponse {
  objects?: NpmSearchObject[]
}

/**
 * Determines tool type from npm package keywords.
 * Returns 'agent-tool' if keywords contain 'tool' or 'agent',
 * otherwise 'sdk-package'.
 */
function inferNpmToolType(keywords: string[]): string {
  const lower = keywords.map((k) => k.toLowerCase())
  if (lower.some((k) => k.includes('tool') || k.includes('agent'))) {
    return 'agent-tool'
  }
  return 'sdk-package'
}

/**
 * Crawls npm for AI-related packages across multiple keyword queries.
 * Deduplicates by package name and returns up to `limit` results.
 */
export async function crawlNpmAiPackages(limit: number): Promise<CrawledService[]> {
  try {
    const seen = new Set<string>()
    const results: CrawledService[] = []

    for (const query of NPM_AI_QUERIES) {
      if (results.length >= limit) break

      try {
        const url = new URL(NPM_SEARCH_URL)
        url.searchParams.set('text', query)
        url.searchParams.set('size', String(Math.min(NPM_RESULTS_PER_QUERY, 250)))

        const res = await fetchWithTimeout(url.toString())
        if (!res.ok) {
          logger.warn('crawler.npm_ai.query_failed', { query, status: res.status })
          continue
        }

        const data = (await res.json()) as NpmSearchResponse
        if (!Array.isArray(data.objects)) continue

        for (const obj of data.objects) {
          if (results.length >= limit) break

          const pkg = obj.package
          if (!pkg || typeof pkg.name !== 'string' || pkg.name.trim().length === 0) continue

          const name = pkg.name.trim()
          const key = name.toLowerCase()
          if (seen.has(key)) continue
          seen.add(key)

          const keywords: string[] = Array.isArray(pkg.keywords)
            ? (pkg.keywords.filter((k): k is string => typeof k === 'string'))
            : []

          const description =
            typeof pkg.description === 'string' ? pkg.description.trim().slice(0, 2000) : ''

          const sourceUrl =
            typeof pkg.links?.repository === 'string'
              ? pkg.links.repository
              : typeof pkg.links?.homepage === 'string'
                ? pkg.links.homepage
                : typeof pkg.links?.npm === 'string'
                  ? pkg.links.npm
                  : `https://www.npmjs.com/package/${name}`

          const authorEmail =
            typeof pkg.publisher?.email === 'string' ? pkg.publisher.email : undefined

          const categoryResult = classifyByKeywords(name, description, keywords)
          const monetization = detectMonetization(sourceUrl, description)
          const pricingInfo = detectPricingFromDescription(description)

          results.push({
            name,
            description,
            sourceUrl,
            source: 'npm',
            toolType: inferNpmToolType(keywords),
            authorEmail,
            enrichment: {
              sourceTags: keywords.slice(0, 20),
              language: 'JavaScript',
              isAlreadyMonetized: monetization.isMonetized,
              monetizationSource: monetization.source,
              detectedCategory: categoryResult?.category,
              categoryConfidence: categoryResult?.confidence,
              detectedPriceCents: pricingInfo?.priceCents,
              detectedPricingModel: pricingInfo?.model,
            },
          })
        }

        logger.info('crawler.npm_ai.query_completed', {
          query,
          totalSoFar: results.length,
        })
      } catch (queryErr) {
        logger.warn('crawler.npm_ai.query_error', {
          query,
          error: queryErr instanceof Error ? queryErr.message : String(queryErr),
        })
      }
    }

    logger.info('crawler.npm_ai.completed', { count: results.length })
    return results
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === 'AbortError'
    logger.warn('crawler.npm_ai.error', {
      msg: isTimeout ? 'Timed out' : 'Fetch failed',
      error: err instanceof Error ? err.message : String(err),
    })
    return []
  }
}

// ─── Source 7: GitHub AI Repositories ───────────────────────────────────────

const GITHUB_SEARCH_URL = 'https://api.github.com/search/repositories'

/** Topic-based search queries for discovering AI tools on GitHub */
const GITHUB_TOPIC_QUERIES = [
  'topic:ai-tool+stars:>10',
  'topic:mcp-server+stars:>10',
  'topic:langchain-tool+stars:>10',
  'topic:ai-agent+stars:>10',
  'topic:llm-tool+stars:>10',
] as const

interface GitHubRepo {
  full_name?: string
  name?: string
  description?: string
  html_url?: string
  stargazers_count?: number
  topics?: string[]
  owner?: {
    login?: string
  }
  forks_count?: number
  updated_at?: string
  license?: {
    spdx_id?: string
    name?: string
  }
  language?: string
  open_issues_count?: number
  watchers_count?: number
}

interface GitHubSearchResponse {
  items?: GitHubRepo[]
  total_count?: number
}

/**
 * Infers tool type from GitHub repository topics.
 */
function inferGitHubToolType(topics: string[]): string {
  const lower = topics.map((t) => t.toLowerCase())

  if (lower.some((t) => t.includes('mcp') || t.includes('model-context-protocol'))) {
    return 'mcp-server'
  }
  if (lower.some((t) => t.includes('agent'))) {
    return 'agent-tool'
  }
  if (lower.some((t) => t.includes('dataset') || t.includes('data'))) {
    return 'dataset'
  }
  if (lower.some((t) => t.includes('model') || t.includes('ml') || t.includes('ai-model'))) {
    return 'ai-model'
  }
  if (lower.some((t) => t.includes('api') || t.includes('rest'))) {
    return 'rest-api'
  }
  if (lower.some((t) => t.includes('sdk') || t.includes('library') || t.includes('package'))) {
    return 'sdk-package'
  }
  if (lower.some((t) => t.includes('automation') || t.includes('workflow'))) {
    return 'automation'
  }
  if (lower.some((t) => t.includes('extension') || t.includes('plugin'))) {
    return 'extension'
  }

  return 'agent-tool'
}

/**
 * Crawls GitHub for AI-related repositories using topic-based search.
 * Uses GITHUB_TOKEN from env for authenticated requests (higher rate limit).
 */
export async function crawlGitHubAiRepos(limit: number): Promise<CrawledService[]> {
  const token = getGitHubToken()
  const headers: Record<string, string> = {}
  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  const seen = new Set<string>()
  const results: CrawledService[] = []

  for (const query of GITHUB_TOPIC_QUERIES) {
    if (results.length >= limit) break

    try {
      const url = new URL(GITHUB_SEARCH_URL)
      url.searchParams.set('q', query)
      url.searchParams.set('sort', 'updated')
      url.searchParams.set('per_page', String(Math.min(100, limit)))

      const res = await fetchWithTimeout(url.toString(), { headers })
      if (!res.ok) {
        // GitHub returns 403 on rate limit, 422 on bad query
        logger.warn('crawler.github.query_failed', { query, status: res.status })
        continue
      }

      const data = (await res.json()) as GitHubSearchResponse
      if (!Array.isArray(data.items)) continue

      for (const repo of data.items) {
        if (results.length >= limit) break
        if (typeof repo !== 'object' || repo === null) continue

        const fullName = typeof repo.full_name === 'string' ? repo.full_name.trim() : ''
        if (!fullName) continue

        const key = fullName.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        const repoName = typeof repo.name === 'string' ? repo.name.trim() : fullName
        const description = typeof repo.description === 'string'
          ? repo.description.trim().slice(0, 2000)
          : ''
        const stars =
          typeof repo.stargazers_count === 'number' && Number.isFinite(repo.stargazers_count)
            ? repo.stargazers_count
            : 0
        const topics: string[] = Array.isArray(repo.topics)
          ? repo.topics.filter((t): t is string => typeof t === 'string')
          : []
        const owner =
          typeof repo.owner?.login === 'string' ? repo.owner.login : fullName.split('/')[0] ?? ''

        const htmlUrl = typeof repo.html_url === 'string'
          ? repo.html_url
          : `https://github.com/${fullName}`

        const fullDesc = `${description} By ${owner}. ${stars.toLocaleString()} stars.`.trim().slice(0, 2000)
        const categoryResult = classifyByKeywords(repoName, fullDesc, topics)
        const monetization = detectMonetization(htmlUrl, fullDesc)
        const pricingInfo = detectPricingFromDescription(fullDesc)
        const forks = typeof repo.forks_count === 'number' && Number.isFinite(repo.forks_count) ? repo.forks_count : 0
        const updatedAt = typeof repo.updated_at === 'string' ? repo.updated_at : undefined
        const license = typeof repo.license?.spdx_id === 'string' ? repo.license.spdx_id : undefined
        const repoLanguage = typeof repo.language === 'string' ? repo.language : undefined

        results.push({
          name: `github-${repoName}`,
          description: fullDesc,
          sourceUrl: htmlUrl,
          source: 'github',
          toolType: inferGitHubToolType(topics),
          enrichment: {
            starCount: stars,
            popularityCount: forks,
            lastUpdatedAt: updatedAt,
            license,
            language: repoLanguage,
            sourceTags: topics.slice(0, 20),
            isAlreadyMonetized: monetization.isMonetized,
            monetizationSource: monetization.source,
            detectedCategory: categoryResult?.category,
            categoryConfidence: categoryResult?.confidence,
            detectedPriceCents: pricingInfo?.priceCents,
            detectedPricingModel: pricingInfo?.model,
          },
        })
      }

      logger.info('crawler.github.query_completed', {
        query,
        totalSoFar: results.length,
      })
    } catch (queryErr) {
      const isTimeout = queryErr instanceof Error && queryErr.name === 'AbortError'
      logger.warn('crawler.github.query_error', {
        query,
        msg: isTimeout ? 'Timed out' : 'Fetch failed',
        error: queryErr instanceof Error ? queryErr.message : String(queryErr),
      })
    }
  }

  logger.info('crawler.github.completed', { count: results.length })
  return results
}

// ─── Unified dispatcher ────────────────────────────────────────────────────

/**
 * Crawls a specific universal source.
 * Returns normalized service entries, up to `limit`.
 */
export async function crawlUniversalSource(
  source: UniversalSource,
  limit: number,
): Promise<CrawledService[]> {
  switch (source) {
    case 'huggingface-models':
      return crawlHuggingFaceModels(limit)
    case 'huggingface-spaces':
      return crawlHuggingFaceSpaces(limit)
    case 'apify':
      return crawlApifyActors(limit)
    case 'pypi':
      return crawlPypiAiPackages(limit)
    case 'replicate':
      return crawlReplicateModels(limit)
    case 'npm-ai':
      return crawlNpmAiPackages(limit)
    case 'github':
      return crawlGitHubAiRepos(limit)
    default:
      logger.warn('crawler.universal.unknown_source', { source })
      return []
  }
}

/**
 * Determines which universal source to crawl based on the current day.
 * Rotates through all sources using modulo on the day-of-year.
 */
export function getUniversalSourceForDay(): UniversalSource {
  const now = new Date()
  const start = new Date(now.getUTCFullYear(), 0, 0)
  const diff = now.getTime() - start.getTime()
  const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24))
  const index = dayOfYear % UNIVERSAL_SOURCES.length
  return UNIVERSAL_SOURCES[index]
}
