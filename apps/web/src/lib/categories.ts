/**
 * Canonical category definitions for programmatic SEO pages.
 *
 * Used by:
 *   - /explore/category/[cat]  (category landing pages)
 *   - /guides/[slug]           (monetization guide pages)
 *   - /solutions/[category]    (solution landing pages)
 *   - sitemap.ts               (auto-generated sitemap entries)
 */

export type CategoryType = 'mcp-tool' | 'ai-service'

export interface CategoryDefinition {
  slug: string
  name: string
  description: string
  color: string
  icon: string
  keywords: string[]
  guideIntro: string
  categoryType: CategoryType
}

export const CATEGORIES: CategoryDefinition[] = [
  {
    slug: 'data',
    name: 'Data & APIs',
    description:
      'MCP tools for data retrieval, API aggregation, database queries, and structured data processing. Monetize access to real-time feeds, geolocation, weather, financial data, and more.',
    color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/25',
    icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
    keywords: ['data API monetization', 'MCP data tools', 'API billing', 'data feed pricing', 'AI data tools'],
    guideIntro:
      'Data & API tools are the backbone of AI agent ecosystems. Agents need real-time data — weather, financial markets, geolocation, public records — and developers who wrap these data sources as MCP tools can earn per-query revenue with zero upfront cost.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'nlp',
    name: 'Natural Language Processing',
    description:
      'MCP tools for text analysis, sentiment detection, translation, summarization, and entity extraction. Build and monetize NLP pipelines that AI agents can invoke on demand.',
    color: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
    icon: 'M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
    keywords: ['NLP tools monetization', 'text analysis API', 'sentiment analysis billing', 'AI language tools', 'MCP NLP'],
    guideIntro:
      'NLP tools are high-demand, high-margin services. Every AI agent that processes text — from chatbots to research assistants — needs capabilities like sentiment analysis, entity extraction, and translation. Wrapping these as MCP tools lets you charge per-analysis.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'image',
    name: 'Image & Vision',
    description:
      'MCP tools for image generation, object detection, OCR, visual analysis, and media processing. Monetize computer vision capabilities that AI agents use for visual understanding.',
    color: 'bg-pink-500/15 text-pink-400 border-pink-500/25',
    icon: 'M2.25 15.75l5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z',
    keywords: ['image API monetization', 'computer vision billing', 'OCR tool pricing', 'AI image tools', 'MCP vision'],
    guideIntro:
      'Image and vision tools command premium pricing because they\'re compute-intensive and hard to build. AI agents need OCR, image classification, object detection, and generation — and they\'re willing to pay per-call for reliable, fast results.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'code',
    name: 'Code & Development',
    description:
      'MCP tools for code analysis, linting, formatting, testing, and development automation. Monetize developer tools that AI coding assistants invoke to improve code quality.',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    icon: 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
    keywords: ['code tools monetization', 'developer API billing', 'linting tool pricing', 'AI code tools', 'MCP developer'],
    guideIntro:
      'Code and development tools sit at the intersection of two massive trends: AI coding assistants and the MCP protocol. Every IDE copilot, code review agent, and CI/CD pipeline is a potential customer for tools that analyze, lint, format, or test code.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'search',
    name: 'Search & Discovery',
    description:
      'MCP tools for web search, document retrieval, semantic search, and knowledge base queries. Monetize search capabilities that AI agents use to find and retrieve information.',
    color: 'bg-violet-500/15 text-violet-400 border-violet-500/25',
    icon: 'M21 21l-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z',
    keywords: ['search API monetization', 'semantic search billing', 'document retrieval pricing', 'AI search tools', 'MCP search'],
    guideIntro:
      'Search tools are the eyes and ears of AI agents. When an agent needs to find documentation, look up facts, or retrieve relevant context, it calls a search tool. This creates a natural per-query billing model that scales with agent activity.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'finance',
    name: 'Finance & Payments',
    description:
      'MCP tools for market data, payment processing, invoicing, fraud detection, and financial analysis. Monetize fintech capabilities that AI agents use for financial operations.',
    color: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    keywords: ['fintech API monetization', 'market data billing', 'payment tool pricing', 'AI finance tools', 'MCP fintech'],
    guideIntro:
      'Finance tools are among the highest-value MCP tools because financial data is time-sensitive and accuracy is critical. Agents that trade, analyze markets, process payments, or detect fraud need reliable financial APIs — and they\'ll pay premium rates for them.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'science',
    name: 'Science & Research',
    description:
      'MCP tools for scientific computation, research paper retrieval, molecular analysis, and data science. Monetize research capabilities that AI agents use for scientific discovery.',
    color: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    icon: 'M9.75 3.104v5.714a2.25 2.25 0 0 1-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 0 1 4.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0 1 12 15a9.065 9.065 0 0 0-6.23.693L5 14.5m14.8.8 1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0 1 12 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5',
    keywords: ['science API monetization', 'research tool billing', 'computation pricing', 'AI science tools', 'MCP research'],
    guideIntro:
      'Science and research tools serve a niche but high-willingness-to-pay market. Researchers and AI agents that need molecular simulations, paper searches, statistical computations, or lab data access will pay per-call for specialized capabilities.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'media',
    name: 'Media & Content',
    description:
      'MCP tools for audio processing, video analysis, content generation, and media manipulation. Monetize media capabilities that AI agents use for content creation and processing.',
    color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25',
    icon: 'M3.375 19.5h17.25m-17.25 0a1.125 1.125 0 0 1-1.125-1.125M3.375 19.5h1.5C5.496 19.5 6 18.996 6 18.375m-3.75 0V5.625m0 12.75v-1.5c0-.621.504-1.125 1.125-1.125m18.375 2.625V5.625m0 12.75c0 .621-.504 1.125-1.125 1.125m1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125m0 3.75h-1.5A1.125 1.125 0 0 1 18 18.375M20.625 4.5H3.375m17.25 0c.621 0 1.125.504 1.125 1.125M20.625 4.5h-1.5C18.504 4.5 18 5.004 18 5.625m3.75 0v1.5c0 .621-.504 1.125-1.125 1.125M3.375 4.5c-.621 0-1.125.504-1.125 1.125M3.375 4.5h1.5C5.496 4.5 6 5.004 6 5.625m-3.75 0v1.5c0 .621.504 1.125 1.125 1.125m0 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125m1.5-3.75C5.496 8.25 6 7.746 6 7.125v-1.5M4.875 8.25C5.496 8.25 6 8.754 6 9.375v1.5m0-5.25v5.25m0-5.25C6 5.004 6.504 4.5 7.125 4.5h9.75c.621 0 1.125.504 1.125 1.125m1.125 2.625h1.5m-1.5 0A1.125 1.125 0 0 1 18 7.125v-1.5m1.125 2.625c-.621 0-1.125.504-1.125 1.125v1.5m2.625-2.625c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125M18 5.625v5.25M7.125 12h9.75m-9.75 0A1.125 1.125 0 0 1 6 10.875M7.125 12C6.504 12 6 12.504 6 13.125m0-2.25C6 11.496 5.496 12 4.875 12M18 10.875c0 .621-.504 1.125-1.125 1.125M18 10.875c0 .621.504 1.125 1.125 1.125m-2.25 0c.621 0 1.125.504 1.125 1.125m-12 5.25v-5.25m0 5.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125m-12 0v-1.5c0-.621-.504-1.125-1.125-1.125M18 18.375v-5.25m0 5.25v-1.5c0-.621.504-1.125 1.125-1.125M18 13.125v1.5c0 .621.504 1.125 1.125 1.125M18 13.125c0-.621.504-1.125 1.125-1.125M6 13.125v1.5c0 .621-.504 1.125-1.125 1.125M6 13.125C6 12.504 5.496 12 4.875 12m-1.5 0h1.5m-1.5 0c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125M19.125 12h1.5m0 0c.621 0 1.125.504 1.125 1.125v1.5c0 .621-.504 1.125-1.125 1.125m-17.25 0h1.5m14.25 0h1.5',
    keywords: ['media API monetization', 'audio processing billing', 'content tool pricing', 'AI media tools', 'MCP media'],
    guideIntro:
      'Media and content tools are increasingly valuable as AI agents move beyond text into multimodal capabilities. Audio transcription, video summarization, image generation, and content formatting are all natural per-call billing candidates.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'security',
    name: 'Security & Compliance',
    description:
      'MCP tools for threat detection, vulnerability scanning, compliance checking, and security analysis. Monetize security capabilities that AI agents use to protect systems and data.',
    color: 'bg-red-500/15 text-red-400 border-red-500/25',
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    keywords: ['security API monetization', 'vulnerability scanning billing', 'compliance tool pricing', 'AI security tools', 'MCP security'],
    guideIntro:
      'Security tools are mission-critical and command premium pricing. Organizations running AI agents need real-time threat intelligence, vulnerability scanning, and compliance verification — and they need it at API speed, not human speed.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'communication',
    name: 'Communication',
    description:
      'MCP tools for email, messaging, notifications, and communication automation. Monetize communication capabilities that AI agents use to interact with users and systems.',
    color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/25',
    icon: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
    keywords: ['communication API monetization', 'email tool billing', 'messaging pricing', 'AI communication tools', 'MCP messaging'],
    guideIntro:
      'Communication tools bridge the gap between AI agents and the humans they serve. Email sending, SMS notifications, chat integrations, and push notifications all have clear per-message billing models that developers can monetize immediately.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'productivity',
    name: 'Productivity',
    description:
      'MCP tools for task management, calendar, document processing, and workflow automation. Monetize productivity capabilities that AI agents use to help users get work done.',
    color: 'bg-teal-500/15 text-teal-400 border-teal-500/25',
    icon: 'M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15a2.25 2.25 0 0 1 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z',
    keywords: ['productivity API monetization', 'task management billing', 'workflow tool pricing', 'AI productivity tools', 'MCP automation'],
    guideIntro:
      'Productivity tools are the bread and butter of AI agent workflows. Calendar management, document formatting, task tracking, and data transformation are all operations that agents perform repeatedly — making per-invocation billing a natural fit.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'analytics',
    name: 'Analytics & BI',
    description:
      'MCP tools for data visualization, business intelligence, metrics tracking, and reporting. Monetize analytics capabilities that AI agents use to derive insights from data.',
    color: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    icon: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
    keywords: ['analytics API monetization', 'BI tool billing', 'metrics pricing', 'AI analytics tools', 'MCP business intelligence'],
    guideIntro:
      'Analytics and BI tools turn raw data into actionable insights — and AI agents are hungry for them. Whether it\'s dashboarding, metric calculation, or trend analysis, analytics tools have clear per-query value that supports straightforward billing.',
    categoryType: 'mcp-tool',
  },
  {
    slug: 'utility',
    name: 'Utility',
    description:
      'MCP tools for encoding, conversion, validation, formatting, and general-purpose operations. Monetize utility functions that AI agents use as building blocks in complex workflows.',
    color: 'bg-gray-500/15 text-gray-400 border-gray-500/25',
    icon: 'M11.42 15.17 17.25 21A2.652 2.652 0 0 0 21 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 1 1-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 0 0 4.486-6.336l-3.276 3.277a3.004 3.004 0 0 1-2.25-2.25l3.276-3.276a4.5 4.5 0 0 0-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437 1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008Z',
    keywords: ['utility API monetization', 'conversion tool billing', 'formatter pricing', 'AI utility tools', 'MCP utility'],
    guideIntro:
      'Utility tools are the Swiss Army knives of AI agent workflows. Encoding, format conversion, validation, and transformation operations may seem simple individually, but they\'re called thousands of times per day — making even low per-call pricing highly profitable.',
    categoryType: 'mcp-tool',
  },

  // ── AI Service Categories ────────────────────────────────────────────────
  {
    slug: 'llm-inference',
    name: 'LLM Inference & AI Models',
    description:
      'Bill every LLM API call with per-token metering. Wrap OpenAI, Anthropic, Google Gemini, Mistral, Replicate, and any inference provider with automatic cost tracking and budget enforcement.',
    color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 0 0-2.455 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    keywords: ['LLM API billing', 'AI inference metering', 'OpenAI billing wrapper', 'per-token billing', 'LLM cost management', 'AI agent budget controller', 'cross-provider AI billing'],
    guideIntro:
      'LLM inference is the largest cost center for AI applications. Per-token billing lets you pass costs through to end users transparently, set per-user budgets, and track cross-provider spend — all without building billing infrastructure from scratch.',
    categoryType: 'ai-service',
  },
  {
    slug: 'search-rag',
    name: 'Search & RAG',
    description:
      'Per-query billing for web search, vector retrieval, and RAG pipelines. Meter every call to Brave, Exa, Tavily, Pinecone, Weaviate, or any search and retrieval API.',
    color: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
    icon: 'M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m5.231 13.481L15 17.25m-4.5-15H5.625c-.621 0-1.125.504-1.125 1.125v16.5c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Zm3.75 11.625a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
    keywords: ['search API billing', 'RAG billing', 'vector database billing', 'semantic search monetization', 'Brave search API billing', 'Pinecone billing wrapper'],
    guideIntro:
      'Search and RAG pipelines are the backbone of context-aware AI. Every web search, vector query, and document retrieval is a billable event. Per-query metering lets you monetize retrieval without managing complex usage tracking.',
    categoryType: 'ai-service',
  },
  {
    slug: 'browser-automation',
    name: 'Browser Automation & Scraping',
    description:
      'Per-page billing for browser automation and web scraping. Wrap Playwright, Browserbase, Firecrawl, Bright Data, or any headless browser with per-action metering.',
    color: 'bg-rose-500/15 text-rose-400 border-rose-500/25',
    icon: 'M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418',
    keywords: ['browser automation billing', 'web scraping billing', 'Playwright billing', 'headless browser monetization', 'Firecrawl billing', 'Browserbase billing'],
    guideIntro:
      'Browser automation is compute-intensive and time-sensitive. Per-page and per-session billing models let you charge for exactly what agents consume — page loads, scrapes, and browser sessions — with automatic metering for every action.',
    categoryType: 'ai-service',
  },
  {
    slug: 'code-execution',
    name: 'Code Execution & Sandboxes',
    description:
      'Per-second billing for code execution and sandbox environments. Wrap E2B, Modal, Replit, AWS Lambda, or any compute sandbox with time-based metering and budget enforcement.',
    color: 'bg-lime-500/15 text-lime-400 border-lime-500/25',
    icon: 'M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z',
    keywords: ['code execution billing', 'sandbox billing', 'E2B billing wrapper', 'compute metering', 'serverless billing', 'Modal billing'],
    guideIntro:
      'Code execution is the ultimate pay-for-what-you-use service. Per-second metering lets you bill compute time precisely, enforce budget caps, and support GPU workloads — all through the same sg.wrap() pattern.',
    categoryType: 'ai-service',
  },
  {
    slug: 'media-generation',
    name: 'Media Generation',
    description:
      'Per-generation billing for image, video, and audio APIs. Wrap DALL-E, Stable Diffusion, Midjourney, Runway, ElevenLabs, Suno, or any media generation service.',
    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
    icon: 'M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z',
    keywords: ['AI image generation billing', 'text-to-speech billing', 'media API monetization', 'DALL-E billing wrapper', 'ElevenLabs billing', 'AI video billing'],
    guideIntro:
      'Media generation commands premium pricing because every output is unique and compute-intensive. Per-generation billing for images, per-second for video, and per-character for voice synthesis all map naturally to sg.wrap() metering.',
    categoryType: 'ai-service',
  },
  {
    slug: 'communication-apis',
    name: 'Communication APIs',
    description:
      'Per-message billing for email, SMS, voice, and push notification APIs. Wrap Twilio, Resend, SendGrid, AWS SES, or any communication service with per-message metering.',
    color: 'bg-slate-500/15 text-slate-400 border-slate-500/25',
    icon: 'M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z',
    keywords: ['email API billing', 'SMS billing', 'Twilio billing wrapper', 'communication API monetization', 'Resend billing', 'voice API billing'],
    guideIntro:
      'Communication APIs have the clearest billing model of any service: per-message. Every email sent, SMS delivered, and voice minute consumed is a discrete billable event that sg.wrap() can meter automatically.',
    categoryType: 'ai-service',
  },
  {
    slug: 'agent-to-agent',
    name: 'Agent-to-Agent Services',
    description:
      'Multi-hop settlement for agent-to-agent workflows. When Agent A delegates to Agent B delegates to Agent C, SettleGrid settles every hop atomically.',
    color: 'bg-stone-500/15 text-stone-400 border-stone-500/25',
    icon: 'M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
    keywords: ['agent payments', 'multi-agent billing', 'A2A settlement', 'agent-to-agent payments', 'multi-hop settlement', 'AI agent delegation billing'],
    guideIntro:
      'Agent-to-agent workflows are the next frontier. When an orchestrator agent delegates to specialized sub-agents, each hop needs billing. SettleGrid is the only system that handles multi-hop settlement atomically across the full agent chain.',
    categoryType: 'ai-service',
  },
  {
    slug: 'data-apis',
    name: 'Data APIs',
    description:
      'Per-call billing for any data API. Weather, finance, geolocation, news — if your API returns data, SettleGrid can meter and bill it with per-query pricing and zero upfront cost.',
    color: 'bg-green-500/15 text-green-400 border-green-500/25',
    icon: 'M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605',
    keywords: ['API monetization', 'data API billing', 'weather API billing', 'financial data billing', 'geolocation API billing', 'per-call API pricing'],
    guideIntro:
      'Data APIs are the simplest services to monetize with SettleGrid. Every query is a billable event — weather lookups, financial data pulls, geocoding requests — and per-call billing scales linearly with usage.',
    categoryType: 'ai-service',
  },
]

export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug)

export const MCP_CATEGORIES = CATEGORIES.filter((c) => c.categoryType === 'mcp-tool')
export const SERVICE_CATEGORIES = CATEGORIES.filter((c) => c.categoryType === 'ai-service')
export const MCP_CATEGORY_SLUGS = MCP_CATEGORIES.map((c) => c.slug)
export const SERVICE_CATEGORY_SLUGS = SERVICE_CATEGORIES.map((c) => c.slug)

export function getCategoryBySlug(slug: string): CategoryDefinition | undefined {
  return CATEGORIES.find((c) => c.slug === slug)
}
