/**
 * settlegrid-url-analyzer — URL Analysis MCP Server
 *
 * Takes a URL and returns parsed components, validation results, and
 * estimated page type classification. Useful for agents processing links
 * from web crawls, validating user input, or extracting structured data
 * from URLs.
 *
 * Methods:
 *   analyze_url(url)             — full URL analysis (2 cents)
 *   parse_query_params(url)      — extract and decode query parameters (2 cents)
 *   compare_urls(url1, url2)     — compare two URLs for equivalence (2 cents)
 *
 * Pricing: 2 cents per call
 * Category: data
 *
 * Deploy: Vercel, Railway, or any Node.js host
 *   SETTLEGRID_TOOL_SLUG=url-analyzer npx tsx url-analyzer.ts
 */

import { settlegrid } from '@settlegrid/mcp'

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

interface AnalyzeInput {
  url: string
}

interface CompareInput {
  url1: string
  url2: string
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

const PAGE_TYPE_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /\/(api|graphql|v[0-9]+)\//i, type: 'api_endpoint' },
  { pattern: /\/(blog|post|article|news)\//i, type: 'blog_post' },
  { pattern: /\/(docs|documentation|guide|tutorial|reference)\//i, type: 'documentation' },
  { pattern: /\/(product|item|shop|store|buy)\//i, type: 'product_page' },
  { pattern: /\/(auth|login|signin|signup|register)\//i, type: 'authentication' },
  { pattern: /\/(dashboard|admin|console|panel)\//i, type: 'dashboard' },
  { pattern: /\/(search|results|query)\/?/i, type: 'search_results' },
  { pattern: /\/(profile|user|account|settings)\//i, type: 'user_profile' },
  { pattern: /\/(pricing|plans|subscription)\//i, type: 'pricing' },
  { pattern: /\/(about|team|contact|company)\//i, type: 'company_info' },
  { pattern: /\/(faq|help|support|knowledge)\//i, type: 'help_page' },
  { pattern: /\/(privacy|terms|legal|tos|gdpr)\//i, type: 'legal' },
  { pattern: /\.(pdf|doc|docx|xlsx|csv)$/i, type: 'document' },
  { pattern: /\.(jpg|jpeg|png|gif|svg|webp)$/i, type: 'image' },
  { pattern: /\.(mp4|avi|mov|webm)$/i, type: 'video' },
  { pattern: /\.(js|ts|py|go|rs|rb|java|css)$/i, type: 'source_code' },
  { pattern: /\.(json|xml|yaml|yml|toml)$/i, type: 'data_file' },
  { pattern: /\/(feed|rss|atom)\/?/i, type: 'feed' },
  { pattern: /\/sitemap\.xml/i, type: 'sitemap' },
  { pattern: /\/robots\.txt/i, type: 'robots_txt' },
]

const KNOWN_DOMAINS: Record<string, string> = {
  'github.com': 'code_repository',
  'gitlab.com': 'code_repository',
  'stackoverflow.com': 'q_and_a',
  'medium.com': 'blog_platform',
  'twitter.com': 'social_media',
  'x.com': 'social_media',
  'linkedin.com': 'professional_network',
  'youtube.com': 'video_platform',
  'reddit.com': 'forum',
  'wikipedia.org': 'encyclopedia',
  'amazon.com': 'marketplace',
  'npmjs.com': 'package_registry',
  'pypi.org': 'package_registry',
}

/* -------------------------------------------------------------------------- */
/*  SettleGrid init                                                           */
/* -------------------------------------------------------------------------- */

const sg = settlegrid.init({
  toolSlug: process.env.SETTLEGRID_TOOL_SLUG || 'url-analyzer',
  pricing: {
    defaultCostCents: 2,
    methods: {
      analyze_url: { costCents: 2, displayName: 'Analyze URL' },
      parse_query_params: { costCents: 2, displayName: 'Parse Query Params' },
      compare_urls: { costCents: 2, displayName: 'Compare URLs' },
    },
  },
})

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function tryParseUrl(input: string): URL | null {
  try {
    // Add protocol if missing
    const urlString = /^https?:\/\//i.test(input) ? input : `https://${input}`
    return new URL(urlString)
  } catch {
    return null
  }
}

function classifyPageType(url: URL): string {
  const fullPath = url.pathname + url.search

  // Check path patterns
  for (const { pattern, type } of PAGE_TYPE_PATTERNS) {
    if (pattern.test(fullPath)) return type
  }

  // Check known domains
  const hostname = url.hostname.replace(/^www\./, '')
  for (const [domain, type] of Object.entries(KNOWN_DOMAINS)) {
    if (hostname === domain || hostname.endsWith(`.${domain}`)) return type
  }

  // Root path
  if (url.pathname === '/' || url.pathname === '') return 'homepage'

  return 'unknown'
}

function extractDomainParts(hostname: string): {
  subdomain: string | null
  domain: string
  tld: string
} {
  const parts = hostname.split('.')
  if (parts.length >= 3) {
    // Handle multi-part TLDs like .co.uk
    const knownMultiTlds = ['co.uk', 'com.au', 'co.jp', 'co.kr', 'com.br', 'co.nz', 'co.za']
    const lastTwo = parts.slice(-2).join('.')
    if (knownMultiTlds.includes(lastTwo) && parts.length >= 4) {
      return {
        subdomain: parts.slice(0, -3).join('.'),
        domain: parts[parts.length - 3],
        tld: lastTwo,
      }
    }
    return {
      subdomain: parts.slice(0, -2).join('.'),
      domain: parts[parts.length - 2],
      tld: parts[parts.length - 1],
    }
  }
  if (parts.length === 2) {
    return { subdomain: null, domain: parts[0], tld: parts[1] }
  }
  return { subdomain: null, domain: hostname, tld: '' }
}

function parseQueryParams(searchString: string): Record<string, string | string[]> {
  const params: Record<string, string | string[]> = {}
  const searchParams = new URLSearchParams(searchString)

  for (const [key, value] of searchParams.entries()) {
    if (key in params) {
      const existing = params[key]
      if (Array.isArray(existing)) {
        existing.push(value)
      } else {
        params[key] = [existing, value]
      }
    } else {
      params[key] = value
    }
  }

  return params
}

/* -------------------------------------------------------------------------- */
/*  Wrapped handlers                                                          */
/* -------------------------------------------------------------------------- */

const analyzeUrl = sg.wrap(async (args: AnalyzeInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required and must be a string')
  }

  const url = tryParseUrl(args.url.trim())
  if (!url) {
    return {
      valid: false,
      input: args.url,
      error: 'Could not parse as a valid URL',
    }
  }

  const domainParts = extractDomainParts(url.hostname)
  const queryParams = parseQueryParams(url.search)
  const pathSegments = url.pathname.split('/').filter((s) => s.length > 0)
  const pageType = classifyPageType(url)
  const hasWww = url.hostname.startsWith('www.')

  return {
    valid: true,
    input: args.url,
    normalized: url.href,
    protocol: url.protocol.replace(':', ''),
    hostname: url.hostname,
    subdomain: domainParts.subdomain,
    domain: domainParts.domain,
    tld: domainParts.tld,
    has_www: hasWww,
    port: url.port || null,
    path: url.pathname,
    path_segments: pathSegments,
    path_depth: pathSegments.length,
    query_string: url.search || null,
    query_params: Object.keys(queryParams).length > 0 ? queryParams : null,
    query_param_count: Object.keys(queryParams).length,
    hash: url.hash || null,
    estimated_page_type: pageType,
    is_secure: url.protocol === 'https:',
    is_localhost: url.hostname === 'localhost' || url.hostname === '127.0.0.1',
    is_ip_address: /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(url.hostname),
  }
}, { method: 'analyze_url' })

const parseParams = sg.wrap(async (args: AnalyzeInput) => {
  if (!args.url || typeof args.url !== 'string') {
    throw new Error('url is required and must be a string')
  }

  const url = tryParseUrl(args.url.trim())
  if (!url) {
    throw new Error('Could not parse as a valid URL')
  }

  const params = parseQueryParams(url.search)
  const entries = Object.entries(params)

  return {
    url: url.href,
    query_string: url.search || null,
    param_count: entries.length,
    params,
    has_params: entries.length > 0,
    param_keys: entries.map(([key]) => key),
  }
}, { method: 'parse_query_params' })

const compareUrls = sg.wrap(async (args: CompareInput) => {
  if (!args.url1 || !args.url2) {
    throw new Error('url1 and url2 are both required')
  }

  const url1 = tryParseUrl(args.url1.trim())
  const url2 = tryParseUrl(args.url2.trim())

  if (!url1 || !url2) {
    return {
      comparable: false,
      error: `Could not parse ${!url1 ? 'url1' : 'url2'} as a valid URL`,
    }
  }

  const sameOrigin = url1.origin === url2.origin
  const samePath = url1.pathname === url2.pathname
  const sameQuery = url1.search === url2.search
  const sameHash = url1.hash === url2.hash
  const sameDomain = url1.hostname.replace(/^www\./, '') === url2.hostname.replace(/^www\./, '')
  const sameProtocol = url1.protocol === url2.protocol
  const identical = url1.href === url2.href
  const equivalentIgnoringWww = sameDomain && samePath && sameQuery && sameHash && sameProtocol

  return {
    comparable: true,
    url1: url1.href,
    url2: url2.href,
    identical,
    equivalent_ignoring_www: equivalentIgnoringWww,
    same_origin: sameOrigin,
    same_domain: sameDomain,
    same_protocol: sameProtocol,
    same_path: samePath,
    same_query: sameQuery,
    same_hash: sameHash,
    differences: [
      ...(!sameProtocol ? ['protocol'] : []),
      ...(!sameDomain ? ['domain'] : []),
      ...(!samePath ? ['path'] : []),
      ...(!sameQuery ? ['query'] : []),
      ...(!sameHash ? ['hash'] : []),
    ],
  }
}, { method: 'compare_urls' })

/* -------------------------------------------------------------------------- */
/*  Exports                                                                   */
/* -------------------------------------------------------------------------- */

export { analyzeUrl, parseParams, compareUrls }

console.log('settlegrid-url-analyzer MCP server ready')
console.log('Methods: analyze_url, parse_query_params, compare_urls')
console.log('Pricing: 2 cents per call | Powered by SettleGrid')
