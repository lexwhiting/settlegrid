/**
 * Curated collection definitions for editorial SEO pages.
 *
 * Used by:
 *   - /explore/collections          (collections hub)
 *   - /explore/collections/[slug]   (individual collection pages)
 *   - sitemap.ts                    (auto-generated sitemap entries)
 */

export interface Collection {
  slug: string
  title: string
  description: string
  intro: string
  toolSlugs: string[]
  keywords: string[]
  icon: string
  relatedCategories: string[]
}

export const COLLECTIONS: Collection[] = [
  {
    slug: 'top-weather-apis',
    title: 'Top Weather & Climate APIs for AI Agents',
    description:
      'Curated list of the best weather and climate APIs that AI agents can invoke for real-time forecasts, historical data, severe weather alerts, and environmental monitoring. Per-call pricing with no monthly minimums.',
    intro:
      'Weather data is one of the most frequently requested data types in AI agent workflows — from travel planning assistants that need 10-day forecasts to logistics agents routing around storms. These APIs give your agent real-time access to meteorological data, climate projections, and severe weather alerts, all billed per-call through SettleGrid.',
    toolSlugs: [
      'openweathermap-mcp',
      'weatherapi-forecast',
      'noaa-climate-data',
      'tomorrow-io-weather',
      'visual-crossing-weather',
      'accuweather-alerts',
      'meteomatics-api',
      'climacell-nowcast',
      'weather-underground-mcp',
      'open-meteo-forecast',
    ],
    keywords: [
      'weather API for AI agents',
      'climate data API',
      'real-time weather MCP',
      'weather forecast API billing',
      'AI weather tools',
      'meteorological data API',
      'severe weather alerts API',
    ],
    icon: 'M2.25 15a4.5 4.5 0 0 0 4.5 4.5H18a3.75 3.75 0 0 0 1.332-7.257 3 3 0 0 0-3.758-3.848 5.25 5.25 0 0 0-10.233 2.33A4.502 4.502 0 0 0 2.25 15Z',
    relatedCategories: ['data', 'science'],
  },
  {
    slug: 'best-code-analysis',
    title: 'Best Code Analysis Tools for AI Agents',
    description:
      'The best code analysis, linting, and quality tools that AI coding assistants can call on demand. Static analysis, security scanning, complexity metrics, and code review automation — all with per-call pricing.',
    intro:
      'AI coding assistants are only as good as the analysis tools they can access. These code analysis tools let your agent run static analysis, detect vulnerabilities, measure complexity, and enforce style guides — without requiring a full CI/CD pipeline. Each tool is callable per-invocation, so your agent pays only for the analyses it actually runs.',
    toolSlugs: [
      'eslint-analyzer-mcp',
      'sonarqube-scanner',
      'semgrep-security',
      'codeclimate-quality',
      'snyk-code-scan',
      'complexity-analyzer',
      'dependency-audit',
      'typescript-checker',
      'prettier-format',
      'codeql-analysis',
    ],
    keywords: [
      'code analysis API for AI',
      'static analysis MCP tool',
      'AI code review automation',
      'linting API billing',
      'security scanning per-call',
      'code quality API',
      'AI coding assistant tools',
    ],
    icon: 'M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5',
    relatedCategories: ['code', 'security'],
  },
  {
    slug: 'essential-data-enrichment',
    title: 'Essential Data Enrichment APIs for AI Agents',
    description:
      'Essential data enrichment APIs that AI agents use to augment raw data with company info, contact details, geolocation, IP intelligence, and entity resolution. Per-call pricing for on-demand enrichment.',
    intro:
      'Raw data is rarely enough. AI agents working in sales, compliance, logistics, and research need enrichment — turning an email into a company profile, an IP address into a geolocation, or a domain into a tech stack. These enrichment APIs provide the missing context your agent needs, billed per-lookup with no subscription required.',
    toolSlugs: [
      'clearbit-enrichment',
      'fullcontact-identity',
      'hunter-email-finder',
      'ipinfo-geolocation',
      'zoominfo-company',
      'people-data-labs',
      'abstract-api-suite',
      'opencorporates-lookup',
      'dnb-business-data',
      'pipl-identity-search',
    ],
    keywords: [
      'data enrichment API',
      'company data API for AI',
      'contact enrichment MCP',
      'IP geolocation API billing',
      'entity resolution API',
      'AI data augmentation tools',
      'lead enrichment per-call',
    ],
    icon: 'M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125',
    relatedCategories: ['data', 'search'],
  },
  {
    slug: 'security-compliance-toolkit',
    title: 'Security & Compliance Toolkit for AI Agents',
    description:
      'A curated toolkit of security and compliance APIs for AI agents — vulnerability scanning, threat intelligence, PCI/SOC2 compliance checks, malware detection, and certificate validation. Per-scan pricing.',
    intro:
      'Security cannot be an afterthought in AI agent workflows. These tools give your agent the ability to scan for vulnerabilities, check compliance posture, validate SSL certificates, and detect threats in real time. Whether your agent manages infrastructure, processes payments, or handles sensitive data, this toolkit keeps it secure — with per-scan pricing that scales with usage.',
    toolSlugs: [
      'shodan-scanner',
      'virustotal-analysis',
      'have-i-been-pwned',
      'ssl-labs-check',
      'nist-nvd-lookup',
      'owasp-zap-scan',
      'crowdstrike-intel',
      'qualys-cloud-scan',
      'vanta-compliance',
      'carbon-black-threat',
    ],
    keywords: [
      'security API for AI agents',
      'vulnerability scanning API',
      'compliance check MCP tool',
      'threat intelligence API billing',
      'malware detection per-call',
      'AI security toolkit',
      'SOC2 compliance API',
    ],
    icon: 'M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z',
    relatedCategories: ['security'],
  },
  {
    slug: 'financial-data-feeds',
    title: 'Financial Data Feeds for AI Agents',
    description:
      'Premium financial data feeds for AI agents — real-time stock quotes, forex rates, crypto prices, economic indicators, and company financials. Per-query pricing with no monthly commitments.',
    intro:
      'Financial data is time-sensitive, high-value, and in constant demand. AI agents that trade, analyze portfolios, generate reports, or monitor markets need reliable, low-latency access to stock quotes, exchange rates, economic indicators, and company filings. These financial data feeds deliver institutional-grade data at per-query prices, so your agent only pays for the data it actually consumes.',
    toolSlugs: [
      'alpha-vantage-stocks',
      'polygon-io-market',
      'finnhub-realtime',
      'iex-cloud-quotes',
      'coinmarketcap-crypto',
      'exchangerate-api',
      'fred-economic-data',
      'sec-edgar-filings',
      'morningstar-fundamentals',
      'quandl-alternative-data',
    ],
    keywords: [
      'financial data API for AI',
      'stock market API billing',
      'forex rates API MCP',
      'crypto price feed per-call',
      'economic data API',
      'AI financial tools',
      'real-time market data API',
    ],
    icon: 'M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
    relatedCategories: ['finance', 'data'],
  },
]

export const COLLECTION_SLUGS = COLLECTIONS.map((c) => c.slug)

export function getCollectionBySlug(slug: string): Collection | undefined {
  return COLLECTIONS.find((c) => c.slug === slug)
}
