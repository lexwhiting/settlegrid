# SettleGrid Universal Expansion Plan
## Granular, File-by-File Implementation Guide
## March 26, 2026

---

## TABLE OF CONTENTS

1. [Priority Order & Phasing](#phase-order)
2. [Section 1: Service Category Landing Pages](#section-1)
3. [Section 2: Category System Expansion](#section-2)
4. [Section 3: Auto-Crawling Expansion](#section-3)
5. [Section 4: Documentation Expansion](#section-4)
6. [Section 5: Blog Content Plan](#section-5)
7. [Section 6: Template Expansion](#section-6)
8. [Section 7: Messaging Audit (EXACT Text Changes)](#section-7)
9. [Section 8: Dashboard Expansion](#section-8)
10. [Section 9: Competitive Positioning](#section-9)
11. [Section 10: Flywheel Updates](#section-10)

---

## PHASE ORDER {#phase-order}

### Phase A: Messaging & Positioning (Days 1-3) — Maximum Territorial Claim with Zero New Pages
These changes transform how SettleGrid is *perceived* without building new features. Every existing page already supports universal billing via `sg.wrap()` — the messaging just needs to match reality.

**Priority: CRITICAL. Do this first. 1-2 days of work.**

1. Homepage messaging update (page.tsx) — 2 hours
2. llms.txt rewrite — 1 hour
3. Docs page FAQ updates (docs/page.tsx) — 2 hours
4. API monetization page update (api-monetization/page.tsx) — 1 hour
5. Learn hub update (learn/page.tsx) — 1 hour
6. JSON-LD schema updates across all pages — 2 hours

### Phase B: Category System & Solutions Pages (Days 4-10)
Build the new category taxonomy and create the 8 service category landing pages.

7. Category system expansion (lib/categories.ts) — 2 hours
8. 8 solution landing pages (/solutions/*) — 3-4 hours each = ~28 hours total
9. Sitemap expansion — 1 hour

### Phase C: Content & SEO Expansion (Days 11-20)
Blog posts, docs guides, and comparison pages targeting non-MCP audiences.

10. 10+ new blog posts in lib/blog-posts.ts — 3 hours each = ~30 hours
11. 8 new how-to guides in lib/howto-guides.ts — 2 hours each = ~16 hours
12. 3 new comparison pages — 3 hours each = ~9 hours
13. New collections for non-MCP services — 2 hours each = ~10 hours

### Phase D: Template & Crawler Expansion (Days 21-30)
Non-MCP templates and new auto-crawling sources.

14. 8-12 non-MCP templates — 2 hours each = ~20 hours
15. New crawler modules — 4-8 hours each = ~40 hours
16. Dashboard category expansion — 4 hours

---

## SECTION 1: SERVICE CATEGORY LANDING PAGES {#section-1}

### Architecture

Create a shared dynamic route at `apps/web/src/app/solutions/[category]/page.tsx` with a data file at `apps/web/src/lib/solutions.ts`. This mirrors the existing pattern of `explore/category/[cat]/page.tsx` + `lib/categories.ts`.

### New Files to Create

#### 1.1 `apps/web/src/lib/solutions.ts` — Solution Data Definitions

```typescript
export interface SolutionDefinition {
  slug: string
  name: string
  headline: string
  subtext: string
  description: string
  keywords: string[]
  billingModel: string
  billingModelDescription: string
  codeExample: string
  codeLanguage: string
  providers: { name: string; pricing: string }[]
  diyPainPoints: string[]
  settlegridBenefits: string[]
  faqItems: { q: string; a: string }[]
  relatedCategories: string[] // slugs from CATEGORIES
  color: string
  icon: string
  jsonLdService: string
  tam: string
}
```

Define 8 solutions:

**1. LLM Inference** (`slug: 'llm-inference'`)
- **URL:** `/solutions/llm-inference`
- **Hero headline:** "Per-Token Billing for LLM Inference in 2 Lines of Code"
- **Subtext:** "Meter every OpenAI, Anthropic, and Google API call. Set per-token budgets, track cross-provider costs, and bill your users automatically. Works with any LLM SDK."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'
import OpenAI from 'openai'

const sg = settlegrid.init({
  toolSlug: 'my-llm-proxy',
  pricing: { model: 'per-token', inputCostPer1k: 0.3, outputCostPer1k: 1.2 },
})

const openai = new OpenAI()

const billedCompletion = sg.wrap(async (args: { prompt: string }) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: args.prompt }],
  })
  return { content: [{ type: 'text', text: response.choices[0].message.content }] }
})
```
- **Billing model:** Per-token (input/output), per-request, per-session
- **Keywords:** "LLM API billing", "AI inference metering", "OpenAI billing wrapper", "per-token billing", "LLM cost management", "AI agent budget controller", "cross-provider AI billing"
- **Providers table:** OpenAI ($4-168/M output tokens), Anthropic ($3-75), Google ($1.25-10), DeepSeek ($0.40), Groq ($0.20-2), Together AI, Fireworks
- **JSON-LD:** SoftwareApplication with offers for LLM inference billing
- **TAM:** $106B inference market (2025)

**2. Search & RAG** (`slug: 'search-rag'`)
- **URL:** `/solutions/search-rag`
- **Hero headline:** "Per-Query Billing for Search and RAG Pipelines"
- **Subtext:** "Bill every web search, vector retrieval, and document query your AI agents make. Per-query metering for Brave, Exa, Pinecone, Weaviate, and any search API."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-search-api',
  pricing: { defaultCostCents: 2, methods: { 'web_search': { costCents: 2 }, 'vector_query': { costCents: 5 } } },
})

const billedSearch = sg.wrap(async (args: { query: string }) => {
  const results = await braveSearch(args.query)
  return { content: [{ type: 'text', text: JSON.stringify(results) }] }
})
```
- **Billing model:** Per-query, per-retrieval, per-GB storage
- **Keywords:** "search API billing", "RAG billing", "vector database billing", "semantic search monetization", "Brave search API billing", "Pinecone billing wrapper"
- **Providers:** Brave ($0.002/call), Exa, Tavily, Pinecone, Weaviate, Qdrant, Elasticsearch
- **TAM:** $4.3B vector DB + web search

**3. Browser Automation** (`slug: 'browser-automation'`)
- **URL:** `/solutions/browser-automation`
- **Hero headline:** "Per-Page Billing for Browser Automation and Web Scraping"
- **Subtext:** "Monetize every page load, scrape, and browser session. Wrap Playwright, Browserbase, Firecrawl, or any headless browser with per-action billing."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'
import { chromium } from 'playwright'

const sg = settlegrid.init({
  toolSlug: 'my-scraper',
  pricing: { model: 'per-call', defaultCostCents: 10 },
})

const billedScrape = sg.wrap(async (args: { url: string }) => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.goto(args.url)
  const content = await page.content()
  await browser.close()
  return { content: [{ type: 'text', text: content }] }
})
```
- **Billing model:** Per-page-load, per-scrape, per-session, per-second
- **Keywords:** "browser automation billing", "web scraping billing", "Playwright billing", "headless browser monetization", "Firecrawl billing", "Browserbase billing"
- **Providers:** Browserbase (per-session), Firecrawl (per-page), Bright Data (per-request), Apify (per-CU), Steel
- **TAM:** $12.34B web scraping software market

**4. Code Execution** (`slug: 'code-execution'`)
- **URL:** `/solutions/code-execution`
- **Hero headline:** "Per-Second Billing for Code Execution and Sandboxes"
- **Subtext:** "Bill for compute time, not flat fees. Wrap E2B, Modal, AWS Lambda, or any sandbox with per-second metering and automatic budget enforcement."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'my-sandbox',
  pricing: { model: 'per-second', costPerSecondCents: 0.5 },
})

const billedExecution = sg.wrap(async (args: { code: string; language: string }) => {
  const startTime = Date.now()
  const result = await e2b.runCode(args.code, { language: args.language })
  const durationMs = Date.now() - startTime
  return {
    content: [{ type: 'text', text: result.output }],
    _meta: { durationMs },
  }
})
```
- **Billing model:** Per-second, per-execution, per-second + GPU
- **Keywords:** "code execution billing", "sandbox billing", "E2B billing wrapper", "compute metering", "serverless billing", "Modal billing"
- **Providers:** E2B (Firecracker), Modal (gVisor), Daytona, Blaxel, Vercel Sandbox, AWS Lambda
- **TAM:** $500M-1B by 2028

**5. Media Generation** (`slug: 'media-generation'`)
- **URL:** `/solutions/media-generation`
- **Hero headline:** "Per-Generation Billing for Image, Video, and Audio APIs"
- **Subtext:** "Monetize every image generated, every video rendered, and every voice clip synthesized. Wrap DALL-E, Stable Diffusion, Runway, ElevenLabs, or any media API."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'
import OpenAI from 'openai'

const sg = settlegrid.init({
  toolSlug: 'my-image-gen',
  pricing: { defaultCostCents: 25 },
})

const openai = new OpenAI()

const billedImageGen = sg.wrap(async (args: { prompt: string; size?: string }) => {
  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: args.prompt,
    size: (args.size as '1024x1024') || '1024x1024',
  })
  return { content: [{ type: 'text', text: response.data[0].url! }] }
})
```
- **Billing model:** Per-generation (images), per-second (video), per-character (voice)
- **Keywords:** "AI image generation billing", "text-to-speech billing", "media API monetization", "DALL-E billing wrapper", "ElevenLabs billing", "AI video billing"
- **Providers:** OpenAI DALL-E ($0.04-0.12/image), Midjourney, Flux, Stable Diffusion, Runway Gen-4, ElevenLabs, Suno
- **TAM:** $3.16B image + $946M video

**6. Communication** (`slug: 'communication'`)
- **URL:** `/solutions/communication`
- **Hero headline:** "Per-Message Billing for Email, SMS, and Voice APIs"
- **Subtext:** "Bill for every email sent, every SMS delivered, and every voice call made. Wrap Twilio, Resend, SendGrid, or any communication API with per-message metering."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'
import { Resend } from 'resend'

const sg = settlegrid.init({
  toolSlug: 'my-email-service',
  pricing: { methods: { 'send_email': { costCents: 1 }, 'send_sms': { costCents: 3 } } },
})

const resend = new Resend(process.env.RESEND_API_KEY)

const billedEmail = sg.wrap(async (args: { to: string; subject: string; body: string }) => {
  const result = await resend.emails.send({
    from: 'notifications@myapp.com',
    to: args.to,
    subject: args.subject,
    html: args.body,
  })
  return { content: [{ type: 'text', text: `Email sent: ${result.id}` }] }
}, { method: 'send_email' })
```
- **Billing model:** Per-message, per-minute (voice), per-email
- **Keywords:** "email API billing", "SMS billing", "Twilio billing wrapper", "communication API monetization", "Resend billing", "voice API billing"
- **Providers:** Twilio (per-message), SendGrid (per-email), Resend (per-email), AWS SES, MessageBird
- **TAM:** $17.2B CPaaS market

**7. Agent-to-Agent** (`slug: 'agent-to-agent'`)
- **URL:** `/solutions/agent-to-agent`
- **Hero headline:** "Multi-Hop Settlement for Agent-to-Agent Workflows"
- **Subtext:** "When Agent A calls Agent B calls Agent C, every hop needs billing. SettleGrid's atomic multi-hop settlement is the only system that handles the full chain."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'research-agent',
  pricing: { model: 'per-call', defaultCostCents: 50 },
})

// This agent delegates to sub-agents — each hop is metered
const billedResearch = sg.wrap(async (args: { topic: string }) => {
  // Sub-agent 1: Search (billed separately via its own sg.wrap)
  const searchResults = await callAgent('search-agent', { query: args.topic })
  // Sub-agent 2: Summarize (billed separately)
  const summary = await callAgent('summarize-agent', { text: searchResults })
  // Multi-hop settlement: all 3 agents are paid atomically
  return { content: [{ type: 'text', text: summary }] }
})
```
- **Billing model:** Per-delegation, per-task, outcome-based
- **Keywords:** "agent payments", "multi-agent billing", "A2A settlement", "agent-to-agent payments", "multi-hop settlement", "AI agent delegation billing"
- **Providers:** CrewAI, LangGraph, AutoGen, Google A2A protocol, Anthropic tool use chains
- **TAM:** Emerging — $1B+ by 2028

**8. Data APIs** (`slug: 'data-apis'`)
- **URL:** `/solutions/data-apis`
- **Hero headline:** "Per-Call Billing for Any Data API"
- **Subtext:** "Weather, finance, geolocation, news — if your API returns data, SettleGrid can meter and bill it. Per-query pricing with zero upfront cost."
- **Code example:**
```typescript
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'weather-api',
  pricing: { methods: { 'current': { costCents: 2 }, 'forecast': { costCents: 5 }, 'historical': { costCents: 10 } } },
})

const billedWeather = sg.wrap(async (args: { location: string; type: string }) => {
  const data = await fetchWeatherData(args.location, args.type)
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}, { method: 'current' })
```
- **Billing model:** Per-call, per-query, per-record
- **Keywords:** "API monetization", "data API billing", "weather API billing", "financial data billing", "geolocation API billing", "per-call API pricing"
- **Providers:** Google Maps, OpenWeatherMap, Alpha Vantage, Polygon, NewsAPI, SerpAPI
- **TAM:** $34B geospatial + $5B financial data

#### 1.2 `apps/web/src/app/solutions/[category]/page.tsx` — Dynamic Route

**File to create.** Uses `generateStaticParams()` from the solutions data. Structure:

```
Section 1: Hero (headline, subtext, badge showing billing model)
Section 2: Code Example (full sg.wrap() example with the specific service)
Section 3: Provider Comparison Table (name, pricing model, market)
Section 4: Billing Model Explanation (which model fits, why)
Section 5: DIY vs SettleGrid Comparison (two-column, red/green)
Section 6: FAQ (4-6 questions specific to this category)
Section 7: CTA (Start Building, link to docs)
```

Each page includes:
- `<Metadata>` with title, description, keywords, canonical, OG, Twitter
- JSON-LD `SoftwareApplication` schema with service-specific offers
- JSON-LD `FAQPage` schema
- Internal links to related category pages, blog posts, and docs

**Effort per page:** ~3-4 hours for data + styling (shared component, unique data)
**Total effort:** ~28-32 hours for all 8 pages

#### 1.3 `apps/web/src/app/solutions/page.tsx` — Solutions Hub

**File to create.** Grid of all 8 solution cards linking to their detail pages. Similar layout to `/explore` page.

- **Title:** "Solutions for Every AI Service"
- **Subtitle:** "SettleGrid bills any async function. Choose your service category to see how."
- **Effort:** 2 hours

---

## SECTION 2: CATEGORY SYSTEM EXPANSION {#section-2}

### Current State

`apps/web/src/lib/categories.ts` has 13 MCP-focused categories:
`data`, `nlp`, `image`, `code`, `search`, `finance`, `science`, `media`, `communication`, `security`, `productivity`, `analytics`, `utility`

These are used by:
- `/explore/category/[cat]` landing pages
- `/guides/[slug]` monetization guides
- `sitemap.ts` for auto-generated entries

### Expansion Plan

**DO NOT modify existing 13 categories.** They serve MCP tool classification well. Instead, create a parallel `ServiceCategory` system for the broader AI service types.

#### 2.1 Modify `apps/web/src/lib/categories.ts`

Add a `categoryType` field to `CategoryDefinition`:

```typescript
export type CategoryType = 'mcp-tool' | 'ai-service'
```

Add 8 new service-type categories to the existing `CATEGORIES` array:

| Slug | Name | Type |
|------|------|------|
| `llm-inference` | LLM Inference | ai-service |
| `search-rag` | Search & RAG | ai-service |
| `browser-automation` | Browser Automation | ai-service |
| `code-execution` | Code Execution | ai-service |
| `media-generation` | Media Generation | ai-service |
| `communication-apis` | Communication APIs | ai-service |
| `agent-to-agent` | Agent-to-Agent | ai-service |
| `data-apis` | Data APIs | ai-service |

Add helper functions:

```typescript
export const MCP_CATEGORIES = CATEGORIES.filter(c => c.categoryType === 'mcp-tool')
export const SERVICE_CATEGORIES = CATEGORIES.filter(c => c.categoryType === 'ai-service')
export const MCP_CATEGORY_SLUGS = MCP_CATEGORIES.map(c => c.slug)
export const SERVICE_CATEGORY_SLUGS = SERVICE_CATEGORIES.map(c => c.slug)
```

#### 2.2 Modify `apps/web/src/app/explore/page.tsx`

Add a top-level toggle or tab: "MCP Tools" | "AI Services" that filters the category grid.

#### 2.3 Modify `apps/web/src/app/sitemap.ts`

Add sitemap entries for:
- `/solutions` hub page
- `/solutions/{slug}` for each of the 8 solution categories

**Effort:** 4 hours total

---

## SECTION 3: AUTO-CRAWLING EXPANSION {#section-3}

### Current State

`apps/web/src/lib/registry-crawlers.ts` and `apps/web/src/lib/mcp-registry/` crawl MCP registries (PulseMCP, mcp.so, Smithery, etc.).

### New Crawlers to Build

#### 3.1 npm AI Package Crawler

**File:** `apps/web/src/lib/crawlers/npm-ai-packages.ts`

**What it does:**
- Queries npm registry for packages with dependencies on `openai`, `@anthropic-ai/sdk`, `replicate`, `@google/generative-ai`, `@huggingface/inference`, `elevenlabs`, `browserbase-sdk`, `@e2b/code-interpreter`
- Extracts: package name, description, weekly downloads, last publish date, GitHub URL, README excerpt
- Indexes as "unclaimed services" — developers haven't added billing yet
- Runs daily via cron

**Data model for unclaimed services:**
```typescript
interface UnclaimedService {
  source: 'npm' | 'pypi' | 'github' | 'rapidapi' | 'huggingface' | 'replicate'
  name: string
  description: string
  url: string
  popularity: number // downloads, stars, etc.
  category: string // mapped to solution category
  aiDependencies: string[] // which AI SDKs it uses
  lastUpdated: string
  claimable: boolean // can a developer claim and monetize this
}
```

**Effort:** 8 hours

#### 3.2 PyPI AI Package Crawler

**File:** `apps/web/src/lib/crawlers/pypi-ai-packages.ts`

**What it does:**
- Queries PyPI for packages depending on `openai`, `anthropic`, `google-generativeai`, `replicate`, `langchain`, `transformers`, `playwright`
- Uses PyPI JSON API (`https://pypi.org/pypi/{package}/json`)
- Cross-references with GitHub for star count
- Indexes as unclaimed services

**Effort:** 6 hours

#### 3.3 GitHub AI Repository Crawler

**File:** `apps/web/src/lib/crawlers/github-ai-repos.ts`

**What it does:**
- Searches GitHub for repos with topics: `openai`, `llm`, `ai-agent`, `langchain`, `browser-automation`, `web-scraping`, `text-to-speech`, `image-generation`
- Filters for repos with 50+ stars, active in last 90 days
- Extracts: repo name, description, stars, language, topics, README excerpt
- Indexes as unclaimed services

**Effort:** 6 hours

#### 3.4 RapidAPI Crawler

**File:** `apps/web/src/lib/crawlers/rapidapi.ts`

**What it does:**
- Crawls RapidAPI categories: AI, Machine Learning, Data, Search, Communication
- Extracts: API name, description, pricing tier, endpoint count, popularity score
- Indexes as "existing paid APIs that could migrate to SettleGrid"

**Effort:** 6 hours

#### 3.5 Hugging Face Spaces Crawler

**File:** `apps/web/src/lib/crawlers/huggingface-spaces.ts`

**What it does:**
- Queries Hugging Face API for Spaces with "api" or "inference" in description
- Filters for Spaces with 100+ likes
- Extracts: Space name, description, model used, runtime, likes
- Indexes as unclaimed inference services

**Effort:** 4 hours

#### 3.6 Replicate Models Crawler

**File:** `apps/web/src/lib/crawlers/replicate-models.ts`

**What it does:**
- Queries Replicate API for popular models
- Extracts: model name, description, run count, pricing, owner
- Indexes as unclaimed media generation / inference services

**Effort:** 4 hours

#### 3.7 Cron Registration

**File to modify:** `apps/web/src/app/api/cron/crawl-services/route.ts` (new)

Register all crawlers on a daily cron schedule. Each crawler writes to a `unclaimed_services` database table.

**Database migration:** Add `unclaimed_services` table:
```sql
CREATE TABLE unclaimed_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  url TEXT NOT NULL,
  popularity INTEGER DEFAULT 0,
  category TEXT,
  ai_dependencies TEXT[] DEFAULT '{}',
  last_crawled_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_by UUID REFERENCES developers(id),
  UNIQUE(source, external_id)
);
```

**Effort for cron + migration:** 4 hours

**Total crawler effort:** ~38 hours

---

## SECTION 4: DOCUMENTATION EXPANSION {#section-4}

### Current State

The `/docs` page is a single long page with FAQ-style sections. No separate per-service-type doc pages exist.

### New Documentation to Add

#### 4.1 Per-Service Billing Guides (add to `apps/web/src/app/docs/page.tsx`)

Add 8 new FAQ sections to the existing docs page, one per service category. Each section includes:
- TypeScript code example
- Python code example (using REST API)
- Pricing model recommendation
- Best practices

**New sections to add to the `faqCategories` array in docs/page.tsx:**

| Section Title | Key Questions |
|---------------|--------------|
| Billing LLM Inference | "How do I bill per-token for OpenAI calls?", "How do I track cross-provider LLM costs?", "What pricing should I use for inference proxies?" |
| Billing Browser Automation | "How do I bill per-page for web scraping?", "How do I meter Playwright sessions?", "Should I charge per-page or per-session?" |
| Billing Media Generation | "How do I bill per-image for DALL-E wrappers?", "How do I meter video generation?", "Per-character billing for TTS" |
| Billing Code Execution | "How do I bill per-second for sandbox compute?", "How do I meter E2B sessions?", "Per-execution vs per-second pricing" |
| Billing Search & RAG | "How do I bill per-query for search APIs?", "How do I meter vector database retrievals?", "Pricing RAG pipelines" |
| Billing Communication APIs | "How do I bill per-email?", "Per-SMS billing setup", "Voice call billing per-minute" |
| Billing Agent-to-Agent | "How does multi-hop settlement work?", "How do I bill for agent delegation?", "Atomic settlement across agent chains" |
| Billing Data APIs | "How do I bill per-query for data APIs?", "Tiered pricing for data endpoints", "Rate-limited billing" |

Each section: 3-5 FAQ entries with code examples.

**Effort:** 6 hours (adding to existing page structure)

#### 4.2 Standalone Service Billing Guides

**New files to create:**

| File | Title |
|------|-------|
| `apps/web/src/app/docs/billing-llm-inference/page.tsx` | How to Bill LLM Inference Calls |
| `apps/web/src/app/docs/billing-browser-automation/page.tsx` | How to Bill Browser Automation |
| `apps/web/src/app/docs/billing-media-generation/page.tsx` | How to Bill Media Generation APIs |
| `apps/web/src/app/docs/billing-code-execution/page.tsx` | How to Bill Code Execution |
| `apps/web/src/app/docs/billing-search-rag/page.tsx` | How to Bill Search & RAG Pipelines |
| `apps/web/src/app/docs/billing-communication/page.tsx` | How to Bill Communication APIs |
| `apps/web/src/app/docs/billing-agent-to-agent/page.tsx` | How to Bill Agent-to-Agent Workflows |
| `apps/web/src/app/docs/billing-data-apis/page.tsx` | How to Bill Data APIs |

Each page contains:
1. Overview (why billing this service type matters, market size)
2. TypeScript Quick Start (full working code example)
3. Python Quick Start (REST API approach)
4. Pricing Model Recommendations (which model, benchmarks)
5. Best Practices (common mistakes, tips)
6. Related services and templates

**Effort:** 3 hours each = ~24 hours

---

## SECTION 5: BLOG CONTENT PLAN {#section-5}

### Current Blog Posts (in `lib/blog-posts.ts`)

5 existing posts:
1. `how-to-monetize-mcp-server`
2. `mcp-billing-comparison-2026`
3. `per-call-billing-ai-agents`
4. `ai-agent-payment-protocols`
5. `free-mcp-monetization`

### New Blog Posts to Add

Add to `apps/web/src/lib/blog-posts.ts`:

#### LLM Inference Category (3 posts)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 6 | `how-to-add-per-token-billing-openai-wrapper` | How to Add Per-Token Billing to Your OpenAI Wrapper | "OpenAI billing wrapper", "per-token billing", "LLM API metering" | 2400 |
| 7 | `cross-provider-ai-cost-management` | Cross-Provider AI Cost Management: One Dashboard for OpenAI + Anthropic + Google | "AI cost management", "LLM cost tracking", "cross-provider billing" | 2200 |
| 8 | `agent-budget-controller-enterprise-guide` | The Agent Budget Controller: How CIOs Should Manage AI Spending | "AI agent budget", "enterprise AI cost control", "AI spending management" | 2800 |

#### Browser Automation Category (2 posts)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 9 | `monetize-web-scraping-api-per-page-billing` | Monetize Your Web Scraping API with Per-Page Billing | "web scraping billing", "scraping API monetization", "per-page billing" | 2000 |
| 10 | `playwright-billing-wrapper-tutorial` | Add Billing to Playwright Automation in 5 Minutes | "Playwright billing", "browser automation billing", "headless browser monetization" | 1800 |

#### Code Execution Category (1 post)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 11 | `per-second-billing-code-execution` | Per-Second Billing for Code Execution Services | "code execution billing", "sandbox billing", "compute metering", "E2B billing" | 2200 |

#### Media Generation Category (2 posts)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 12 | `billing-ai-image-generation-apis` | How to Bill AI Image Generation APIs: DALL-E, Stable Diffusion, Flux | "AI image generation billing", "DALL-E billing", "image API monetization" | 2000 |
| 13 | `text-to-speech-billing-elevenlabs` | Per-Character Billing for Text-to-Speech APIs | "TTS billing", "ElevenLabs billing", "text-to-speech monetization" | 1800 |

#### Agent-to-Agent Category (2 posts)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 14 | `multi-agent-billing-settlement-problem` | Multi-Agent Billing: Solving the Settlement Problem | "multi-agent billing", "agent-to-agent payments", "A2A settlement" | 2600 |
| 15 | `ai-agent-delegation-billing-patterns` | Billing Patterns for AI Agent Delegation | "agent delegation billing", "multi-hop settlement", "agent payment chains" | 2200 |

#### Cross-Category Posts (3 posts)
| # | Slug | Title | Target Keywords | Word Count |
|---|------|-------|----------------|------------|
| 16 | `universal-settlement-layer-ai-economy` | Why Every AI Service Call Should Be a Billable Event | "AI settlement layer", "universal AI billing", "AI economy infrastructure" | 3000 |
| 17 | `settlegrid-vs-stripe-for-ai-billing` | SettleGrid vs Stripe for AI Service Billing: When to Use Which | "SettleGrid vs Stripe", "AI billing platform comparison", "Stripe AI billing" | 2400 |
| 18 | `six-pricing-models-ai-services` | 6 Pricing Models for AI Services: Which One Fits? | "AI pricing models", "per-token vs per-call", "usage-based AI billing" | 2600 |

**Effort per post:** 3 hours (data definition in blog-posts.ts)
**Total effort:** ~39 hours for 13 new posts

---

## SECTION 6: TEMPLATE EXPANSION {#section-6}

### Current State

1,017 MCP server templates exist in `/open-source-servers/`. 4 REST API templates exist in the templates section.

### New Non-MCP Templates to Create

Each template is a standalone project in a directory under a new `open-source-services/` directory, with:
- `README.md` with SettleGrid branding
- Working source code (TypeScript)
- `package.json` with dependencies
- `settlegrid.config.ts` pre-wired
- Deploy instructions (Vercel, Railway, Fly.io)

#### Templates by Category

| # | Template Name | Category | Billing Model | Key Dependencies |
|---|--------------|----------|---------------|------------------|
| 1 | `llm-proxy-openai` | LLM Inference | Per-token | `openai`, `@settlegrid/mcp` |
| 2 | `llm-proxy-anthropic` | LLM Inference | Per-token | `@anthropic-ai/sdk`, `@settlegrid/mcp` |
| 3 | `llm-proxy-multi` | LLM Inference | Per-token | `openai`, `@anthropic-ai/sdk`, `@settlegrid/mcp` |
| 4 | `browser-scraper-playwright` | Browser Automation | Per-page | `playwright`, `@settlegrid/mcp` |
| 5 | `browser-scraper-firecrawl` | Browser Automation | Per-page | `@mendable/firecrawl-js`, `@settlegrid/mcp` |
| 6 | `image-gen-dalle` | Media Generation | Per-generation | `openai`, `@settlegrid/mcp` |
| 7 | `tts-elevenlabs` | Media Generation | Per-character | `elevenlabs`, `@settlegrid/mcp` |
| 8 | `search-brave` | Search & RAG | Per-query | `brave-search`, `@settlegrid/mcp` |
| 9 | `search-vector-pinecone` | Search & RAG | Per-query | `@pinecone-database/pinecone`, `@settlegrid/mcp` |
| 10 | `sandbox-e2b` | Code Execution | Per-second | `@e2b/code-interpreter`, `@settlegrid/mcp` |
| 11 | `email-resend` | Communication | Per-email | `resend`, `@settlegrid/mcp` |
| 12 | `sms-twilio` | Communication | Per-message | `twilio`, `@settlegrid/mcp` |

**Effort per template:** 2 hours
**Total effort:** ~24 hours

---

## SECTION 7: MESSAGING AUDIT — EXACT TEXT CHANGES {#section-7}

### 7.1 Homepage (`apps/web/src/app/page.tsx`)

#### Metadata (lines 15-33)

**CURRENT title (line 16):**
```
'SettleGrid — Per-Call Billing for Any API in 2 Lines of Code'
```
**REPLACEMENT:**
```
'SettleGrid — The Universal Settlement Layer for AI Services'
```

**CURRENT description (lines 17-18):**
```
'The settlement layer for AI and API payments. Per-call billing, usage metering, and automated payouts for MCP tools, REST APIs, serverless functions, and AI agents. Free forever — 50K ops/month, progressive take rates. 10 protocols. Open source SDK.'
```
**REPLACEMENT:**
```
'The universal settlement layer for AI services. Per-call, per-token, and per-second billing for LLM inference, browser automation, media generation, code execution, search, communication, and agent-to-agent workflows. One SDK. Ten protocols. Free forever — 50K ops/month.'
```

**CURRENT keywords (lines 20-32):**
```
['MCP monetization', 'AI agent payments', 'settlement layer', 'per-call billing', 'AI tool billing', 'Model Context Protocol', 'x402', 'AP2', 'developer tools', 'API monetization', 'usage-based billing', 'AI economy']
```
**REPLACEMENT:**
```
['AI settlement layer', 'LLM billing', 'AI agent payments', 'per-token billing', 'per-call billing', 'AI service metering', 'browser automation billing', 'media generation billing', 'agent-to-agent payments', 'API monetization', 'usage-based billing', 'AI economy', 'MCP monetization', 'code execution billing', 'universal AI billing']
```

#### JSON-LD SoftwareApplication (line 44-46)

**CURRENT description (line 44-45):**
```
'The settlement layer for the AI economy. Per-call billing, usage metering, and automated payouts across 10 protocols — MCP, x402, AP2, MPP, Visa TAP, UCP, and more. Progressive take rate: 0% on first $1K/mo. Free tier: 50K ops/month.'
```
**REPLACEMENT:**
```
'The universal settlement layer for AI services. Bill any AI service call — LLM inference, browser automation, media generation, code execution, search, communication, agent-to-agent workflows — with per-call, per-token, or per-second metering across 10 protocols. Progressive take rate: 0% on first $1K/mo.'
```

#### JSON-LD Organization (lines 88-89)

**CURRENT description:**
```
'SettleGrid is the protocol-agnostic settlement layer for the AI economy. One SDK. Ten protocols. Progressive take rate: 0% on first $1K/mo. Supports MCP, x402, AP2, MPP, Visa TAP, UCP, ACP, Mastercard Agent Pay, Circle Nanopayments, and REST.'
```
**REPLACEMENT:**
```
'SettleGrid is the universal settlement layer for AI services. Bill LLM inference, browser automation, media generation, code execution, search APIs, communication, and agent-to-agent workflows. One SDK. Ten protocols. Progressive take rate: 0% on first $1K/mo.'
```

#### JSON-LD Product (lines 100-101)

**CURRENT description:**
```
'@settlegrid/mcp — TypeScript SDK for adding per-call billing, usage metering, and budget enforcement to any MCP tool, REST API, or AI agent.'
```
**REPLACEMENT:**
```
'@settlegrid/mcp — TypeScript SDK for adding per-call, per-token, and per-second billing to any AI service — LLM inference, browser automation, media generation, code execution, MCP tools, REST APIs, and agent-to-agent workflows.'
```

#### JSON-LD FAQ — "What is SettleGrid?" (lines 120-123)

**CURRENT answer:**
```
'SettleGrid is the settlement layer for AI agent payments. It lets developers monetize any AI service — MCP tools, REST APIs, AI agents, model endpoints — with per-call billing, usage metering, budget enforcement, and automated Stripe payouts.'
```
**REPLACEMENT:**
```
'SettleGrid is the universal settlement layer for AI services. It lets developers bill any AI service call — LLM inference, browser automation, media generation, code execution, search, communication, MCP tools, REST APIs, and agent-to-agent workflows — with per-call, per-token, or per-second metering, budget enforcement, and automated Stripe payouts.'
```

#### Hero headline (line 549-551)

**CURRENT:**
```
Per-call billing for any API in{' '}
<span className="text-brand-light">2 lines of code</span>
```
**REPLACEMENT:**
```
Bill any AI service in{' '}
<span className="text-brand-light">2 lines of code</span>
```

#### Hero subtext (lines 555-556)

**CURRENT:**
```
The settlement layer for AI and API payments. Metering, billing, Stripe payouts, and a full analytics dashboard — all from one SDK.
```
**REPLACEMENT:**
```
The universal settlement layer for AI services. LLM inference, browser automation, media generation, code execution, search, communication — metered, billed, and settled from one SDK.
```

#### Hero secondary text (lines 558-559)

**CURRENT:**
```
Works with MCP servers, REST APIs, and any function that accepts input and returns output. 10 protocols. Progressive take rate: 0% on first $1K/mo.
```
**REPLACEMENT:**
```
Works with OpenAI, Anthropic, Playwright, DALL-E, E2B, Twilio, MCP servers, REST APIs, and any async function. 10 protocols. Progressive take rate: 0% on first $1K/mo.
```

#### Core feature cards (around line 184-200)

Currently the 6 feature cards focus on: Real-time metering, Protocol-agnostic, Multi-hop settlement, Agent identity, Outcome billing, Enterprise.

**ADD a 7th card** between Protocol-agnostic and Multi-hop:
```
{
  icon: <Icon d="M2.25 7.125C2.25 6.504..." />,
  title: 'Any AI Service',
  description: 'LLM inference, browser automation, media generation, code execution, search, communication — sg.wrap() bills any async function, not just MCP tools.',
}
```

### 7.2 Homepage "How It Works" Section (around line 724)

**CURRENT Step 1 description:**
```
"npm install the SDK, set your pricing, and wrap your handler. MCP tool, REST API, or AI agent — five lines of code, any protocol."
```
**REPLACEMENT:**
```
"npm install the SDK, set your pricing, and wrap your handler. LLM proxy, browser scraper, image generator, MCP tool, REST API — five lines of code, any service."
```

### 7.3 Docs Page (`apps/web/src/app/docs/page.tsx`)

#### Metadata description (line 10)

**CURRENT:**
```
'Quick-start guide, SDK reference, and API documentation for SettleGrid.'
```
**REPLACEMENT:**
```
'Quick-start guide, SDK reference, and API documentation for SettleGrid. Billing guides for LLM inference, browser automation, media generation, code execution, search, and more.'
```

#### FAQ: "What is SettleGrid?" (line 37)

**CURRENT:**
```
'SettleGrid is the settlement layer for the AI economy. It lets developers monetize any AI service — MCP tools, REST APIs, AI agents, model endpoints — with one SDK and one unified billing, metering, and payout system. Think of it as "Stripe for AI services" with real-time metering, multi-protocol support, and automatic revenue splits.'
```
**REPLACEMENT:**
```
'SettleGrid is the universal settlement layer for AI services. It lets developers bill any AI service call — LLM inference, browser automation, media generation, code execution, search, communication, MCP tools, REST APIs, and agent-to-agent workflows — with one SDK. Per-call, per-token, and per-second metering. Ten protocols. Automatic Stripe payouts. Think of it as the billing infrastructure for every AI service your agents call.'
```

#### FAQ: "Does the SDK work with non-MCP services?" (line 77)

**CURRENT:**
```
'Yes. While the package is called @settlegrid/mcp, it includes a settlegridMiddleware() function for REST APIs (Express, Fastify, etc.). The SDK\'s wrap() function works with any async handler regardless of protocol.'
```
**REPLACEMENT:**
```
'Yes. The SDK\'s sg.wrap() function works with any async function — OpenAI calls, Playwright sessions, DALL-E generations, E2B sandbox executions, Twilio sends, or any function that accepts input and returns output. settlegridMiddleware() wraps REST endpoints. The billing pipeline is protocol-agnostic and service-agnostic.'
```

### 7.4 API Monetization Page (`apps/web/src/app/api-monetization/page.tsx`)

#### Hero subtext (line 97-98)

**CURRENT:**
```
SettleGrid works with REST APIs, Express routes, serverless functions, and any callable endpoint.
Add metering, billing, and payouts in 5 minutes — not 3-4 weeks.
```
**REPLACEMENT:**
```
SettleGrid works with LLM proxies, browser scrapers, image generators, code sandboxes, search APIs, communication services, REST APIs, and any callable endpoint.
Add metering, billing, and payouts in 5 minutes — not 3-4 weeks.
```

### 7.5 Learn Hub (`apps/web/src/app/learn/page.tsx`)

#### "Explore Tools by Category" card (lines 143-154)

**CURRENT description:**
```
'Browse all monetized AI tools across 13 categories — data, NLP, code, finance, security, and more. Each category has its own landing page with tools, pricing, and a monetization guide.'
```
**REPLACEMENT:**
```
'Browse AI tools and services across 21 categories — LLM inference, browser automation, media generation, code execution, data, NLP, code, finance, security, and more. MCP tools and AI service categories each have landing pages with tools, pricing, and billing guides.'
```

**CURRENT badge:**
```
'13 categories'
```
**REPLACEMENT:**
```
'21 categories'
```

#### Add new card: "Solutions by Service Type"

Add a new `SectionCard` to the `SECTIONS` array:

```typescript
{
  title: 'Solutions by Service Type',
  description:
    'Billing guides for every type of AI service — LLM inference, browser automation, media generation, code execution, search & RAG, communication APIs, agent-to-agent workflows, and data APIs. Code examples, pricing recommendations, and provider comparisons.',
  href: '/solutions',
  badge: '8 service types',
  icon: (/* grid/layers icon SVG */),
}
```

### 7.6 llms.txt (`apps/web/public/llms.txt`)

#### Opening paragraph (lines 1-7)

**CURRENT:**
```
> The settlement layer for the AI economy. Monetize any AI service — MCP tools, REST APIs, AI agents, model endpoints — with one SDK, ten protocols, and zero vendor lock-in. Free forever for most developers.

SettleGrid lets developers monetize any AI service with 2 lines of code. Install the SDK, wrap your handler, set a price — and every call is metered, billed, and settled automatically.
```
**REPLACEMENT:**
```
> The universal settlement layer for AI services. Bill any AI service call — LLM inference, browser automation, media generation, code execution, search, communication, MCP tools, REST APIs, and agent-to-agent workflows — with one SDK, ten protocols, and zero vendor lock-in. Free forever for most developers.

SettleGrid lets developers bill any AI service with 2 lines of code. Wrap an OpenAI call, a Playwright session, a DALL-E generation, an E2B sandbox execution, a Twilio send, or any async function — and every call is metered, billed, and settled automatically. Per-call, per-token, and per-second pricing models.
```

#### Instructions for LLM Agents section (lines 9-20)

**ADD after the existing bullet points:**

```markdown
- **For LLM inference billing**: Wrap any OpenAI, Anthropic, or Google SDK call with sg.wrap() for per-token metering. Works for inference proxies, model routers, and agent budget controllers.
- **For browser automation billing**: Wrap Playwright, Browserbase, or Firecrawl calls with per-page or per-session metering.
- **For media generation billing**: Wrap DALL-E, Stable Diffusion, ElevenLabs, or Runway calls with per-generation metering.
- **For code execution billing**: Wrap E2B, Modal, or Lambda invocations with per-second compute metering.
- **For search & RAG billing**: Wrap Brave Search, Pinecone, or Weaviate queries with per-query metering.
- **For agent-to-agent billing**: Use multi-hop atomic settlement for agent delegation chains where each hop is metered independently.
```

#### Add new section: "Service Categories"

After the "What SettleGrid Does" section, add:

```markdown
## Supported Service Categories

SettleGrid bills any async function. Here are the primary service categories:

- **LLM Inference**: OpenAI, Anthropic, Google, DeepSeek, Groq — per-token or per-request billing
- **Browser Automation**: Playwright, Browserbase, Firecrawl, Apify — per-page or per-session billing
- **Media Generation**: DALL-E, Stable Diffusion, Runway, ElevenLabs, Suno — per-generation billing
- **Code Execution**: E2B, Modal, AWS Lambda — per-second compute billing
- **Search & RAG**: Brave, Pinecone, Weaviate, Exa — per-query billing
- **Communication**: Twilio, Resend, SendGrid — per-message billing
- **Agent-to-Agent**: CrewAI, LangGraph, AutoGen chains — per-delegation billing with multi-hop settlement
- **Data APIs**: Weather, finance, geolocation, news — per-call billing
- **MCP Tools**: 20,000+ Model Context Protocol servers — per-call billing (core product)
- **REST APIs**: Any HTTP endpoint — middleware billing
```

### 7.7 FAQ Page (`apps/web/src/app/faq/page.tsx`)

Add new FAQ entries:

```
Q: Does SettleGrid only work with MCP servers?
A: No. SettleGrid's sg.wrap() function works with any async function — OpenAI inference calls, Playwright browser sessions, DALL-E image generations, E2B code executions, Twilio messages, or any function that accepts input and returns output. MCP is the primary use case, but the billing pipeline is service-agnostic.

Q: What types of AI services can I bill with SettleGrid?
A: SettleGrid supports billing for LLM inference (per-token), browser automation (per-page), media generation (per-generation), code execution (per-second), search and RAG (per-query), communication APIs (per-message), agent-to-agent delegation (per-hop), data APIs (per-call), and any other async function.

Q: Can I use SettleGrid as a budget controller for my AI agents?
A: Yes. Set per-agent spending limits across all services — LLM inference, tool calls, browser sessions, and more. When an agent hits its budget, SettleGrid returns HTTP 402. One dashboard shows cross-provider spending for OpenAI, Anthropic, Google, and all tool calls.
```

### 7.8 Header Navigation (in `page.tsx` line 480-491)

**ADD** a "Solutions" link between "Templates" and "Docs":
```tsx
<Link href="/solutions" className="hidden sm:inline text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-indigo dark:hover:text-white transition-colors">
  Solutions
</Link>
```

This change also needs to be applied in:
- `apps/web/src/app/api-monetization/page.tsx` (header nav)
- `apps/web/src/app/learn/page.tsx` (if it has its own header)
- Any shared layout component

**Total Section 7 effort:** ~12 hours

---

## SECTION 8: DASHBOARD EXPANSION {#section-8}

### Current State

The dashboard is at `apps/web/src/app/(dashboard)/`. Tool creation allows selecting from the 13 MCP categories.

### Changes Needed

#### 8.1 Tool Creation: Category Dropdown

**File:** `apps/web/src/app/(dashboard)/dashboard/tools/new/page.tsx` (or wherever tool creation form lives)

Expand the category dropdown to include the 8 new AI service categories. Group them:
```
-- MCP Tool Categories --
Data & APIs
Natural Language Processing
Image & Vision
... (existing 13)

-- AI Service Categories --
LLM Inference
Browser Automation
Media Generation
Code Execution
Search & RAG
Communication APIs
Agent-to-Agent
Data APIs
```

#### 8.2 Analytics: Service Type Breakdown

**File:** `apps/web/src/app/(dashboard)/dashboard/page.tsx` (main dashboard)

Add a "Service Type" breakdown to analytics showing invocations grouped by:
- MCP Tools
- LLM Inference
- Browser Automation
- Media Generation
- etc.

This requires the tool's category to determine its service type, then aggregate.

#### 8.3 Tool Detail Page: Billing Model Selection

When creating/editing a tool, if the category is an AI service category, suggest the appropriate billing model:
- LLM Inference → suggest per-token
- Browser Automation → suggest per-page/per-session
- Code Execution → suggest per-second
- Media Generation → suggest per-generation
- Communication → suggest per-message

**Effort:** 6 hours total

---

## SECTION 9: COMPETITIVE POSITIONING {#section-9}

### New Comparison Pages to Create

#### 9.1 `apps/web/src/app/learn/compare/vs-stripe-metronome/page.tsx`

**Title:** "SettleGrid vs Stripe Metronome for AI Service Billing"

**Key differentiators:**
| Feature | SettleGrid | Stripe Metronome |
|---------|-----------|-----------------|
| AI-native primitives | Agent identity (KYA), per-agent budgets, multi-hop settlement | No agent-specific features |
| Discovery marketplace | Built-in tool discovery, 1,017 templates | No discovery |
| Setup time | 2 lines of code | Weeks of integration |
| Free tier | 50K ops/month, $0 | No free tier |
| Protocol support | 10 protocols (MCP, x402, AP2, etc.) | REST only |
| Per-token metering | Native | Custom meter definitions needed |
| Minimum payout | $1 | $100+ via Stripe Connect |
| Best for | AI services, MCP tools, agent builders | General SaaS usage billing |

**Positioning:** "Stripe Metronome is a general-purpose usage billing engine. SettleGrid is purpose-built for AI services with agent identity, multi-hop settlement, protocol support, and a discovery marketplace that Metronome doesn't have."

#### 9.2 `apps/web/src/app/learn/compare/vs-orb/page.tsx`

**Title:** "SettleGrid vs Orb for AI Billing"

**Key differentiators:**
| Feature | SettleGrid | Orb |
|---------|-----------|-----|
| Focus | AI services & agent payments | General usage billing |
| Discovery | Built-in marketplace | None |
| Agent identity | KYA, trust scoring | None |
| Protocol support | 10 AI payment protocols | REST/webhook |
| Free tier | 50K ops/month | No free tier |
| Multi-hop settlement | Atomic agent chains | None |
| Best for | AI service billing | SaaS companies (Perplexity, Vercel) |

#### 9.3 `apps/web/src/app/learn/compare/vs-lago/page.tsx`

**Title:** "SettleGrid vs Lago for AI Service Billing"

**Key differentiators:**
| Feature | SettleGrid | Lago |
|---------|-----------|------|
| Model | Managed SaaS + SDK | Self-hosted open source |
| Setup time | 2 lines of code | Deploy + configure infrastructure |
| AI-native features | Agent identity, multi-hop, protocol support | None (general billing) |
| Discovery | Built-in marketplace | None |
| Free tier | 50K ops/month managed | Free (self-hosted) |
| Maintenance | Zero | You manage infrastructure |
| Best for | AI developers who want zero ops | Teams who want full control |

#### 9.4 Universal Positioning Statement

**Add to all comparison pages and the homepage:**

"Generic billing platforms (Stripe, Orb, Lago, Chargebee) solve 'how do I bill my customers.' SettleGrid solves 'how do I bill every AI service call my agents make.' Four differences: (1) AI-native primitives — agent identity, per-agent budgets, multi-hop settlement. (2) Discovery + billing in one system — agents find and pay for services in one API. (3) Protocol-native — 10 AI payment protocols, not just REST. (4) Developer-first free tier — 50K ops/month, $1 minimum payout, 0% on first $1K/mo."

**Effort:** 4 hours per comparison page = ~12 hours

---

## SECTION 10: FLYWHEEL UPDATES {#section-10}

### 10.1 Crawlers (New Sources to Index)

See Section 3 above. Add crawlers for:
- npm packages using AI SDKs
- PyPI AI packages
- GitHub AI repositories
- RapidAPI AI APIs
- Hugging Face Spaces
- Replicate models

Index all as "unclaimed services" in the database. Display on a new `/unclaimed` page showing services that developers can claim and monetize through SettleGrid.

### 10.2 GridBot Expansion

**Current:** GridBot uses SettleGrid tools (MCP) to answer questions.

**Expansion:** GridBot should also:
- Wrap LLM inference calls through SettleGrid (dog-fooding per-token metering)
- Use browser automation tools through SettleGrid (dog-fooding per-page billing)
- Generate real cross-service transaction data for dashboard demos

**File to modify:** Wherever GridBot is configured, add non-MCP service calls wrapped with `sg.wrap()`.

### 10.3 Claim Outreach Expansion

**Current:** Outreach targets MCP server developers.

**Expansion:** Also target:
- npm package authors who have `openai` or `anthropic` as dependencies
- PyPI package authors who have `openai` or `langchain` as dependencies
- GitHub repo owners with 100+ stars in AI tooling categories
- RapidAPI developers with AI-category APIs

**Outreach template for non-MCP developers:**

```
Subject: Monetize {package_name} with per-call billing

Hi {name},

I saw your {package_name} package that wraps {ai_sdk}. It has {downloads} weekly downloads.

SettleGrid lets you add per-{billing_model} billing to {package_name} with 2 lines of code:

const sg = settlegrid.init({ toolSlug: '{package_name}' })
const billed = sg.wrap(your_handler, { costCents: X })

Your users get API keys, auto-refill credits, and spending limits.
You get Stripe payouts with 0% take on your first $1K/mo.

Would you be interested in a 5-minute walkthrough?
```

### 10.4 Weekly Report Expansion

**Current:** Weekly report includes MCP server data.

**Expansion:** Add sections for:
- Unclaimed AI services crawled this week (by category)
- Non-MCP service registrations
- Cross-service transaction volume
- Category growth trends (which service types are growing fastest)

### 10.5 Reddit Monitoring Expansion

**Current subreddits:** r/mcp, r/ClaudeAI

**Add these subreddits to monitoring:**
- r/OpenAI (discussions about billing OpenAI wrappers)
- r/LocalLLaMA (inference proxy billing)
- r/MachineLearning (model serving billing)
- r/webscraping (scraping API monetization)
- r/learnprogramming (API monetization questions)
- r/SaaS (usage-based billing discussions)
- r/Entrepreneur (API business discussions)
- r/artificial (general AI discussions about agent payments)
- r/LangChain (agent billing discussions)

**Monitor for keywords:** "bill", "monetize", "charge", "pricing", "metering", "usage-based", "per-call", "per-token", "API key", "billing wrapper"

**Effort for all flywheel updates:** ~20 hours

---

## COMPLETE FILE INVENTORY

### Files to MODIFY (existing)

| # | File | Changes | Effort |
|---|------|---------|--------|
| 1 | `apps/web/src/app/page.tsx` | Metadata, JSON-LD, hero text, feature cards, how-it-works, nav | 4h |
| 2 | `apps/web/src/app/docs/page.tsx` | Metadata, FAQ sections, 8 new billing guides in FAQ | 6h |
| 3 | `apps/web/src/app/api-monetization/page.tsx` | Hero subtext, code examples, nav | 2h |
| 4 | `apps/web/src/app/learn/page.tsx` | New section card, updated category count, nav | 2h |
| 5 | `apps/web/src/lib/categories.ts` | Add categoryType field, 8 new service categories, helper fns | 2h |
| 6 | `apps/web/src/app/sitemap.ts` | Add /solutions/* entries, /docs/billing-* entries, unclaimed pages | 1h |
| 7 | `apps/web/public/llms.txt` | Rewrite intro, add service categories, expand LLM instructions | 2h |
| 8 | `apps/web/src/app/faq/page.tsx` | Add 3+ new FAQ entries about non-MCP services | 1h |
| 9 | `apps/web/src/lib/blog-posts.ts` | Add 13 new blog post data definitions | 12h |
| 10 | `apps/web/src/lib/howto-guides.ts` | Add 8 new how-to guide definitions | 8h |
| 11 | `apps/web/src/app/explore/page.tsx` | Add MCP/AI Services toggle | 2h |
| 12 | `apps/web/src/app/(dashboard)/dashboard/*` | Category dropdown, analytics breakdown | 4h |

### Files to CREATE (new)

| # | File | Purpose | Effort |
|---|------|---------|--------|
| 13 | `apps/web/src/lib/solutions.ts` | Solution page data definitions (8 solutions) | 6h |
| 14 | `apps/web/src/app/solutions/page.tsx` | Solutions hub page | 2h |
| 15 | `apps/web/src/app/solutions/[category]/page.tsx` | Dynamic solution landing pages | 4h |
| 16 | `apps/web/src/app/docs/billing-llm-inference/page.tsx` | LLM inference billing guide | 3h |
| 17 | `apps/web/src/app/docs/billing-browser-automation/page.tsx` | Browser billing guide | 3h |
| 18 | `apps/web/src/app/docs/billing-media-generation/page.tsx` | Media gen billing guide | 3h |
| 19 | `apps/web/src/app/docs/billing-code-execution/page.tsx` | Code exec billing guide | 3h |
| 20 | `apps/web/src/app/docs/billing-search-rag/page.tsx` | Search/RAG billing guide | 3h |
| 21 | `apps/web/src/app/docs/billing-communication/page.tsx` | Communication billing guide | 3h |
| 22 | `apps/web/src/app/docs/billing-agent-to-agent/page.tsx` | A2A billing guide | 3h |
| 23 | `apps/web/src/app/docs/billing-data-apis/page.tsx` | Data API billing guide | 3h |
| 24 | `apps/web/src/app/learn/compare/vs-stripe-metronome/page.tsx` | Metronone comparison | 4h |
| 25 | `apps/web/src/app/learn/compare/vs-orb/page.tsx` | Orb comparison | 4h |
| 26 | `apps/web/src/app/learn/compare/vs-lago/page.tsx` | Lago comparison | 4h |
| 27 | `apps/web/src/lib/crawlers/npm-ai-packages.ts` | npm crawler | 8h |
| 28 | `apps/web/src/lib/crawlers/pypi-ai-packages.ts` | PyPI crawler | 6h |
| 29 | `apps/web/src/lib/crawlers/github-ai-repos.ts` | GitHub crawler | 6h |
| 30 | `apps/web/src/lib/crawlers/rapidapi.ts` | RapidAPI crawler | 6h |
| 31 | `apps/web/src/lib/crawlers/huggingface-spaces.ts` | HF Spaces crawler | 4h |
| 32 | `apps/web/src/lib/crawlers/replicate-models.ts` | Replicate crawler | 4h |
| 33 | `apps/web/src/app/api/cron/crawl-services/route.ts` | Cron endpoint | 4h |
| 34-45 | `open-source-services/llm-proxy-openai/` etc. | 12 non-MCP templates | 24h |

### Database Migrations

| # | Migration | Purpose | Effort |
|---|-----------|---------|--------|
| 46 | Add `unclaimed_services` table | Store crawled non-MCP services | 2h |
| 47 | Add `category_type` column to tools | Distinguish MCP vs AI service tools | 1h |

### Content Pieces to Write

| # | Type | Count | Effort Each | Total |
|---|------|-------|------------|-------|
| 48-60 | Blog posts | 13 | 3h | 39h |
| 61-68 | How-to guides | 8 | 2h | 16h |
| 69-76 | Solution page content | 8 | 3h | 24h |
| 77-84 | Doc billing guides | 8 | 3h | 24h |
| 85-87 | Comparison pages | 3 | 4h | 12h |

---

## TOTAL EFFORT SUMMARY

| Phase | Items | Hours | Priority |
|-------|-------|-------|----------|
| A: Messaging & Positioning | 12 file modifications | ~16h | CRITICAL (Days 1-3) |
| B: Category System & Solutions | 10 new files + 3 modifications | ~36h | HIGH (Days 4-10) |
| C: Content & SEO | 24 content pieces | ~91h | HIGH (Days 11-20) |
| D: Templates & Crawlers | 18 new files | ~64h | MEDIUM (Days 21-30) |
| E: Dashboard & Flywheel | 4 modifications + config | ~30h | MEDIUM (Days 25-35) |
| **TOTAL** | **~47 files modified/created** | **~237h** | |

---

## IMPLEMENTATION NOTES FOR BUILD AGENTS

1. **Phase A is non-negotiable Day 1 work.** Every messaging change uses EXACT current text and EXACT replacement text specified above. Find-and-replace operations, not rewrites.

2. **The solutions data file (`lib/solutions.ts`) is the single most important new file.** It feeds the dynamic route, the sitemap, the nav, and the learn hub. Build it first in Phase B.

3. **Blog posts are data definitions, not rendered pages.** The `[slug]/page.tsx` dynamic route already exists. Adding posts means adding entries to the `BLOG_POSTS` array in `lib/blog-posts.ts`. Each entry is a structured object with sections, not a markdown file.

4. **All new pages must include:** Metadata (title, description, keywords, canonical, OG, Twitter), JSON-LD structured data, internal cross-links to related pages, and consistent header/footer.

5. **SEO rule:** Every new page targets at least 3 keywords not currently covered by any existing page.

6. **The 12 non-MCP templates follow the exact same structure** as existing templates in `open-source-servers/`. Copy the template structure, swap the dependencies and handler code.

7. **Crawlers are standalone modules** that export a `crawl()` async function returning `UnclaimedService[]`. The cron route calls all crawlers and upserts results.

8. **Do not modify existing MCP-focused content.** The expansion is additive. MCP remains the core — the universal positioning wraps around it.
