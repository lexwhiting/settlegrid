import Link from 'next/link'
import type { Metadata } from 'next'
import { Navbar } from '@/components/marketing/navbar'
import { Footer } from '@/components/marketing/footer'
import { FreeToolsGrid } from './free-tools-grid'

export const metadata: Metadata = {
  title: 'Free AI Tools | SettleGrid',
  description:
    'Call any of these 29 free API tools with no authentication required. Wikipedia, forex rates, dad jokes, air quality, ISS tracking, and more. Works with MCP, REST, or direct HTTP.',
  alternates: { canonical: 'https://settlegrid.ai/free-tools' },
  keywords: [
    'free API tools',
    'free AI tools',
    'free MCP tools',
    'free REST API',
    'free developer tools',
    'no API key',
    'SettleGrid free tools',
    'MCP server tools',
  ],
}

interface FreeToolDef {
  slug: string
  name: string
  description: string
  category: string
}

const FREE_TOOLS: FreeToolDef[] = [
  { slug: 'wikipedia', name: 'Wikipedia', description: 'Article summaries, search, and random articles from Wikipedia', category: 'Knowledge' },
  { slug: 'rest-countries', name: 'REST Countries', description: 'Country data by name, code, region, or currency', category: 'Data' },
  { slug: 'spacex', name: 'SpaceX', description: 'Latest SpaceX launch data and mission details', category: 'Science' },
  { slug: 'hacker-news', name: 'Hacker News', description: 'Top, new, and best stories from Hacker News', category: 'News' },
  { slug: 'dad-jokes', name: 'Dad Jokes', description: 'Random dad jokes from icanhazdadjoke', category: 'Fun' },
  { slug: 'iss-tracker', name: 'ISS Tracker', description: 'Real-time International Space Station position', category: 'Science' },
  { slug: 'random-user', name: 'Random User', description: 'Generate random user profiles with names, emails, and avatars', category: 'Data' },
  { slug: 'open-food-facts', name: 'Open Food Facts', description: 'Nutritional data and product info by barcode', category: 'Data' },
  { slug: 'coinpaprika', name: 'Coinpaprika', description: 'Cryptocurrency prices and market data', category: 'Finance' },
  { slug: 'openaq', name: 'OpenAQ', description: 'Global air quality measurements from OpenAQ', category: 'Science' },
  { slug: 'whois', name: 'WHOIS', description: 'Domain registration lookup', category: 'Networking' },
  { slug: 'wayback-machine', name: 'Wayback Machine', description: 'Check Wayback Machine availability for any URL', category: 'Web' },
  { slug: 'mdn-search', name: 'MDN Search', description: 'Search MDN Web Docs for web development references', category: 'Developer' },
  { slug: 'ssl-labs', name: 'SSL Labs', description: 'SSL/TLS certificate grade check for any domain', category: 'Security' },
  { slug: 'security-headers', name: 'Security Headers', description: 'HTTP security header analysis for any URL', category: 'Security' },
  { slug: 'solar-system', name: 'Solar System', description: 'Solar system body data: planets, moons, and asteroids', category: 'Science' },
  { slug: 'forex-rates', name: 'Forex Rates', description: 'Live foreign exchange rates from ECB', category: 'Finance' },
  { slug: 'central-bank-rates', name: 'Central Bank Rates', description: 'Central bank interest rates worldwide', category: 'Finance' },
  { slug: 'ip-range', name: 'IP Range', description: 'IP address range and CIDR calculations', category: 'Networking' },
  { slug: 'cron-explain', name: 'Cron Explain', description: 'Human-readable explanations of cron expressions', category: 'Developer' },
  { slug: 'json-tools', name: 'JSON Tools', description: 'JSON formatting, validation, and transformation', category: 'Developer' },
  { slug: 'diff-tool', name: 'Diff Tool', description: 'Text diff and comparison utility', category: 'Developer' },
  { slug: 'encoding', name: 'Encoding', description: 'Base64, URL, and HTML encoding/decoding', category: 'Developer' },
  { slug: 'semver', name: 'Semver', description: 'Semantic version parsing, comparison, and range checking', category: 'Developer' },
  { slug: 'code-reviewer-pro', name: 'Code Reviewer Pro', description: 'AI-powered code review suggestions', category: 'AI' },
  { slug: 'data-enrichment', name: 'Data Enrichment', description: 'Data enrichment and entity resolution', category: 'AI' },
  { slug: 'image-classifier', name: 'Image Classifier', description: 'Image classification and tagging', category: 'AI' },
  { slug: 'market-sentinel', name: 'Market Sentinel', description: 'Market data monitoring and alerts', category: 'Finance' },
  { slug: 'translation-engine', name: 'Translation Engine', description: 'Multi-language text translation', category: 'AI' },
]

export default function FreeToolsPage() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Free AI Tools on SettleGrid',
    description: 'Free API tools with no authentication required.',
    numberOfItems: FREE_TOOLS.length,
    itemListElement: FREE_TOOLS.map((tool, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      item: {
        '@type': 'SoftwareApplication',
        name: tool.name,
        description: tool.description,
        applicationCategory: 'DeveloperApplication',
        url: `https://settlegrid.ai/api/tools/serve/${tool.slug}`,
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
        },
      },
    })),
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Navbar />

      <main className="flex-1 px-6 py-16 pt-24">
        <div className="max-w-6xl mx-auto">
          {/* JSON-LD structured data */}
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          {/* Hero */}
          <div className="text-center mb-14">
            <p className="text-sm font-medium tracking-[0.2em] uppercase text-muted-foreground mb-4">
              No API Key Required
            </p>
            <h1 className="text-4xl sm:text-5xl font-medium tracking-tight text-foreground mb-4">
              Free AI Tools
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              Call any of these tools for free. No API key required. Works via GET, POST, or through the{' '}
              <Link href="/docs#meta-mcp" className="text-[#E5A336] hover:underline">
                Meta-MCP Server
              </Link>.
            </p>
            <div className="mt-4 mx-auto max-w-xl rounded-lg border border-border bg-card px-5 py-3 text-sm text-muted-foreground">
              <code className="text-[#E5A336]">GET</code>{' '}
              <code>https://settlegrid.ai/api/tools/serve/&#123;slug&#125;</code>
            </div>
          </div>

          {/* Tool Grid */}
          <FreeToolsGrid tools={FREE_TOOLS} />

          {/* Bottom CTA */}
          <div className="mt-16 rounded-lg border border-border bg-card p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-medium tracking-tight text-foreground mb-3">
              Want to monetize your own tool?
            </h2>
            <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
              Register for a free account, wrap your functions with the SDK, and start earning on every call.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/start"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium bg-[#E5A336] text-[#0a0a0a] rounded-md hover:bg-[#d4922f] transition-all hover:shadow-[0_4px_16px_-4px_rgba(229,163,54,0.4)]"
              >
                Start Building — Free
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-medium text-foreground border border-border rounded-md hover:bg-accent transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  )
}
