import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { CopyableCodeBlock } from '@/components/ui/copyable-code-block'

/* -------------------------------------------------------------------------- */
/*  Metadata                                                                   */
/* -------------------------------------------------------------------------- */

export const metadata: Metadata = {
  title: 'How to Get Discovered on SettleGrid — Maximize Your Tool Visibility',
  description:
    'A step-by-step guide to making your AI tools findable by consumers and AI agents on SettleGrid. Profiles, badges, Discovery API, reputation tiers, and distribution strategies.',
  alternates: { canonical: 'https://settlegrid.ai/learn/discovery' },
  keywords: [
    'SettleGrid discovery',
    'MCP tool discoverability',
    'AI tool distribution',
    'MCP showcase',
    'developer profile',
    'tool discovery API',
    'MCP Discovery Server',
    'AI tool marketing',
    'MCP server visibility',
    'tool reputation',
  ],
}

/* -------------------------------------------------------------------------- */
/*  JSON-LD TechArticle Schema                                                 */
/* -------------------------------------------------------------------------- */

const jsonLdArticle = {
  '@context': 'https://schema.org',
  '@type': 'TechArticle',
  headline: 'How to Get Discovered on SettleGrid',
  description:
    'A step-by-step guide to making your AI tools findable by consumers and AI agents. Covers public profiles, badges, Discovery API, reputation tiers, and distribution strategies.',
  author: {
    '@type': 'Organization',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
  },
  publisher: {
    '@type': 'Organization',
    name: 'SettleGrid',
    url: 'https://settlegrid.ai',
    logo: {
      '@type': 'ImageObject',
      url: 'https://settlegrid.ai/brand/icon-color.svg',
    },
  },
  datePublished: '2026-03-24',
  dateModified: '2026-03-24',
  url: 'https://settlegrid.ai/learn/discovery',
  mainEntityOfPage: 'https://settlegrid.ai/learn/discovery',
  keywords: [
    'MCP discovery',
    'AI tool visibility',
    'developer profiles',
    'tool badges',
    'Discovery API',
    'reputation tiers',
  ],
  articleSection: 'Developer Guides',
  wordCount: 2500,
}

/* -------------------------------------------------------------------------- */
/*  Reusable components                                                        */
/* -------------------------------------------------------------------------- */

function StepHeading({ id, number, title }: { id: string; number: number; title: string }) {
  return (
    <div id={id} className="scroll-mt-24 mb-6 mt-16 first:mt-0">
      <p className="text-sm font-semibold text-emerald-400 tracking-wide uppercase mb-1">
        Step {number}
      </p>
      <h2 className="text-2xl sm:text-3xl font-bold text-gray-100">{title}</h2>
    </div>
  )
}

function Callout({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-6 border-l-4 border-emerald-500 bg-emerald-500/5 rounded-r-lg px-5 py-4 text-sm text-gray-300 leading-relaxed">
      {children}
    </div>
  )
}

function ChecklistItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <svg className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
      </svg>
      <span>{children}</span>
    </li>
  )
}

function TocLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <a href={href} className="text-gray-400 hover:text-emerald-400 transition-colors text-sm">
        {children}
      </a>
    </li>
  )
}

/* -------------------------------------------------------------------------- */
/*  Page                                                                       */
/* -------------------------------------------------------------------------- */

export default function DiscoveryGuidePage() {
  return (
    <div className="dark min-h-screen flex flex-col bg-[#0F1117] text-gray-100">
      {/* JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }}
      />

      {/* ---- Header ---- */}
      <header className="border-b border-[#2E3148] px-6 py-4 bg-[#0F1117]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Learn
            </Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">
              Docs
            </Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark transition-colors">
              Start Building
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main content ---- */}
      <main className="flex-1 px-6 py-16">
        <article className="max-w-3xl mx-auto">

          {/* ================================================================ */}
          {/*  Hero                                                            */}
          {/* ================================================================ */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold px-3 py-1.5 rounded-full mb-6">
              Discovery guide &middot; 6 steps &middot; Maximize visibility
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-4 leading-tight">
              How to Get{' '}
              <span className="text-emerald-400">Discovered</span>
            </h1>
            <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
              A step-by-step guide to making your tools findable by consumers and AI agents
              on SettleGrid.
            </p>
          </div>

          {/* ================================================================ */}
          {/*  Table of Contents                                               */}
          {/* ================================================================ */}
          <nav className="mb-16 bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-6" aria-label="Table of contents">
            <p className="text-xs font-semibold text-emerald-400 tracking-wide uppercase mb-4">Contents</p>
            <ol className="space-y-2.5 list-decimal list-inside">
              <TocLink href="#public-profile">Enable Your Public Profile</TocLink>
              <TocLink href="#publish-tools">Publish Active Tools</TocLink>
              <TocLink href="#badges">Add Badges to Your README</TocLink>
              <TocLink href="#discovery-api">Leverage the Discovery API</TocLink>
              <TocLink href="#reputation">Build Your Reputation</TocLink>
              <TocLink href="#share-profile">Share Your Profile</TocLink>
            </ol>
          </nav>

          {/* ================================================================ */}
          {/*  Step 1: Enable Your Public Profile                              */}
          {/* ================================================================ */}
          <StepHeading id="public-profile" number={1} title="Enable Your Public Profile" />

          <p className="text-gray-300 leading-relaxed mb-4">
            Your developer profile is the foundation of your presence on SettleGrid.
            It is the page consumers and agents land on when they want to see who you are
            and what you have built.
          </p>

          <ul className="space-y-3 text-gray-300 leading-relaxed mb-6">
            <ChecklistItem>
              Go to <strong className="text-gray-100">Settings &rarr; Profile</strong> in your dashboard
            </ChecklistItem>
            <ChecklistItem>
              Set a memorable slug (e.g., <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">lexwhiting</code>) &mdash; this becomes your permanent URL
            </ChecklistItem>
            <ChecklistItem>
              Write a bio describing what you build and the problems your tools solve
            </ChecklistItem>
            <ChecklistItem>
              Toggle <strong className="text-gray-100">publicProfile</strong> on
            </ChecklistItem>
          </ul>

          <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-gray-100 mb-2">Your profile URL</p>
            <p className="text-emerald-400 font-mono text-sm">
              settlegrid.ai/dev/&#123;slug&#125;
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Example: settlegrid.ai/dev/lexwhiting
            </p>
          </div>

          <Callout>
            <strong className="text-emerald-400">Tip:</strong> A complete profile with a bio, slug, and at least one
            active tool significantly improves your ranking in search results and the Showcase.
          </Callout>

          {/* ================================================================ */}
          {/*  Step 2: Publish Active Tools                                    */}
          {/* ================================================================ */}
          <StepHeading id="publish-tools" number={2} title="Publish Active Tools" />

          <p className="text-gray-300 leading-relaxed mb-4">
            Tools in <strong className="text-gray-100">draft</strong> status are invisible to the outside world.
            Only active tools appear in the Showcase, Discovery API, and agent queries.
          </p>

          <ul className="space-y-3 text-gray-300 leading-relaxed mb-6">
            <ChecklistItem>
              Set your tool status to <strong className="text-gray-100">active</strong> to appear in the{' '}
              <Link href="/tools" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">Showcase</Link>
            </ChecklistItem>
            <ChecklistItem>
              Add a <strong className="text-gray-100">category</strong> and <strong className="text-gray-100">tags</strong> &mdash; these power search and filtering
            </ChecklistItem>
            <ChecklistItem>
              Write a clear, concise description &mdash; this is what consumers see first
            </ChecklistItem>
            <ChecklistItem>
              Include pricing information so consumers know what to expect before they integrate
            </ChecklistItem>
          </ul>

          <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-gray-100 mb-3">Good description vs. bad description</p>
            <div className="space-y-3 text-sm">
              <div>
                <p className="text-red-400 font-medium mb-1">Bad: &quot;My web search tool&quot;</p>
                <p className="text-gray-500">Too vague. Consumers and agents cannot determine what this does or why it is better.</p>
              </div>
              <div>
                <p className="text-emerald-400 font-medium mb-1">Good: &quot;Web search with structured JSON output, source attribution, and freshness scoring. Returns the top 10 results with title, snippet, URL, and publish date.&quot;</p>
                <p className="text-gray-500">Specific, scannable, and tells consumers exactly what they get.</p>
              </div>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Step 3: Add Badges to Your README                               */}
          {/* ================================================================ */}
          <StepHeading id="badges" number={3} title="Add Badges to Your README" />

          <p className="text-gray-300 leading-relaxed mb-4">
            Badges on your GitHub README create inbound links to SettleGrid and signal to developers
            that your tool is professionally monetized. Every badge links back to settlegrid.ai.
          </p>

          <h3 className="text-lg font-bold text-gray-100 mt-8 mb-3">Powered by SettleGrid</h3>
          <CopyableCodeBlock
            title="Markdown"
            code="![Powered by SettleGrid](https://settlegrid.ai/api/badge/powered-by)"
          />

          <h3 className="text-lg font-bold text-gray-100 mt-8 mb-3">Tool badge</h3>
          <p className="text-gray-300 leading-relaxed mb-3">
            Shows your tool name and current status. Replace <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">&#123;slug&#125;</code> with your tool slug.
          </p>
          <CopyableCodeBlock
            title="Markdown"
            code="![SettleGrid](https://settlegrid.ai/api/badge/tool/{slug})"
          />

          <h3 className="text-lg font-bold text-gray-100 mt-8 mb-3">Developer badge</h3>
          <p className="text-gray-300 leading-relaxed mb-3">
            Shows your developer profile and reputation tier. Replace <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">&#123;slug&#125;</code> with your developer slug.
          </p>
          <CopyableCodeBlock
            title="Markdown"
            code="![SettleGrid](https://settlegrid.ai/api/badge/dev/{slug})"
          />

          <Callout>
            <strong className="text-emerald-400">Why badges matter:</strong> Every badge click is a potential new consumer.
            Badges also improve your SEO by creating backlinks from GitHub to SettleGrid, which boosts
            your tool&apos;s ranking in the Showcase and Discovery API.
          </Callout>

          {/* ================================================================ */}
          {/*  Step 4: Leverage the Discovery API                              */}
          {/* ================================================================ */}
          <StepHeading id="discovery-api" number={4} title="Leverage the Discovery API" />

          <p className="text-gray-300 leading-relaxed mb-4">
            Once your tool is active, it is automatically included in SettleGrid&apos;s discovery
            infrastructure. No action needed on your part &mdash; publishing an active tool means
            automatic inclusion.
          </p>

          <div className="space-y-6 mb-6">
            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Discovery API</h3>
              <p className="text-sm text-gray-400 mb-3">
                Your tools are queryable via <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">GET /api/v1/discover</code>.
                Third-party directories, IDE plugins, and integrations can search and embed your tools.
              </p>
            </div>

            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">MCP Discovery Server</h3>
              <p className="text-sm text-gray-400 mb-3">
                AI agents using the MCP Discovery Server can find your tools by capability,
                category, or name. When an agent needs a tool, your active listing surfaces automatically.
              </p>
            </div>

            <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5">
              <h3 className="text-lg font-bold text-gray-100 mb-1">Showcase</h3>
              <p className="text-sm text-gray-400 mb-3">
                The{' '}
                <Link href="/tools" className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
                  SettleGrid Showcase
                </Link>
                {' '}is the public catalog of all active tools. It supports full-text search,
                category filtering, and sorting by reputation, price, and recency.
              </p>
            </div>
          </div>

          <Callout>
            <strong className="text-emerald-400">Zero configuration:</strong> You do not need to register with
            the Discovery API or MCP Discovery Server separately. Publishing your tool as active on SettleGrid
            automatically makes it available through all discovery channels.
          </Callout>

          {/* ================================================================ */}
          {/*  Step 5: Build Your Reputation                                   */}
          {/* ================================================================ */}
          <StepHeading id="reputation" number={5} title="Build Your Reputation" />

          <p className="text-gray-300 leading-relaxed mb-4">
            SettleGrid assigns reputation tiers to developers based on the quality and reliability
            of their tools. Higher reputation means higher ranking in the Showcase and Discovery API.
          </p>

          <div className="overflow-x-auto rounded-xl border border-[#2E3148] mb-6">
            <table className="w-full text-sm" role="table" aria-label="Reputation tiers and requirements">
              <thead>
                <tr className="border-b border-[#2E3148] bg-[#1A1D2E]">
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Tier</th>
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Requirement</th>
                  <th scope="col" className="text-left py-3 px-4 font-medium text-gray-400">Benefit</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-[#2E3148]/50">
                  <td className="py-3 px-4 font-medium text-amber-600">Bronze</td>
                  <td className="py-3 px-4 text-gray-300">Profile complete, 1+ active tool</td>
                  <td className="py-3 px-4 text-gray-400">Listed in Showcase</td>
                </tr>
                <tr className="border-b border-[#2E3148]/50">
                  <td className="py-3 px-4 font-medium text-gray-300">Silver</td>
                  <td className="py-3 px-4 text-gray-300">95%+ uptime, positive reviews</td>
                  <td className="py-3 px-4 text-gray-400">Priority ranking in search</td>
                </tr>
                <tr className="border-b border-[#2E3148]/50">
                  <td className="py-3 px-4 font-medium text-yellow-400">Gold</td>
                  <td className="py-3 px-4 text-gray-300">99%+ uptime, 3+ tools, strong reviews</td>
                  <td className="py-3 px-4 text-gray-400">Featured in Showcase, Discovery API boost</td>
                </tr>
                <tr className="border-b border-[#2E3148]/50 last:border-b-0">
                  <td className="py-3 px-4 font-medium text-emerald-400">Platinum</td>
                  <td className="py-3 px-4 text-gray-300">Top-tier uptime, high volume, excellent reputation</td>
                  <td className="py-3 px-4 text-gray-400">Homepage feature, premium badge, agent priority</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-lg font-bold text-gray-100 mt-8 mb-3">Reputation Factors</h3>
          <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4 mb-6">
            <li><strong className="text-gray-100">Uptime</strong> &mdash; consistent availability is the single biggest factor</li>
            <li><strong className="text-gray-100">Response time</strong> &mdash; faster tools rank higher</li>
            <li><strong className="text-gray-100">Consumer reviews</strong> &mdash; respond to reviews to show you are engaged</li>
            <li><strong className="text-gray-100">Tool count</strong> &mdash; more active tools signal a serious developer</li>
          </ul>

          <Callout>
            <strong className="text-emerald-400">Tips for climbing tiers:</strong> Respond to consumer reviews promptly.
            Set up health monitoring to catch downtime before it affects your score. Keep tools updated
            and deprecate anything you no longer maintain. Consistency beats perfection.
          </Callout>

          {/* ================================================================ */}
          {/*  Step 6: Share Your Profile                                      */}
          {/* ================================================================ */}
          <StepHeading id="share-profile" number={6} title="Share Your Profile" />

          <p className="text-gray-300 leading-relaxed mb-4">
            Your developer profile at <code className="text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded text-xs">settlegrid.ai/dev/&#123;slug&#125;</code> is
            a public, linkable page that showcases all your active tools, reputation tier, and bio.
            Treat it as your professional identity in the AI tool economy.
          </p>

          <ul className="list-disc list-inside text-gray-300 leading-relaxed space-y-1.5 ml-4 mb-6">
            <li><strong className="text-gray-100">Social media</strong> &mdash; share your profile on X/Twitter, LinkedIn, and Bluesky</li>
            <li><strong className="text-gray-100">GitHub</strong> &mdash; link from your GitHub profile README and repository descriptions</li>
            <li><strong className="text-gray-100">Personal site</strong> &mdash; add a &quot;My AI Tools&quot; section that links to your SettleGrid profile</li>
            <li><strong className="text-gray-100">Blog &amp; content</strong> &mdash; reference your tools and profile in technical blog posts</li>
            <li><strong className="text-gray-100">Conference talks</strong> &mdash; include your profile URL on slides when presenting</li>
            <li><strong className="text-gray-100">API documentation</strong> &mdash; link to your SettleGrid profile as the canonical source for your tools</li>
          </ul>

          <div className="bg-[#1A1D2E] border border-[#2E3148] rounded-xl p-5 mb-6">
            <p className="text-sm font-semibold text-gray-100 mb-3">Quick links to share</p>
            <div className="space-y-2 text-sm font-mono">
              <p className="text-gray-300">
                Profile: <span className="text-emerald-400">settlegrid.ai/dev/&#123;slug&#125;</span>
              </p>
              <p className="text-gray-300">
                Tool page: <span className="text-emerald-400">settlegrid.ai/tools/&#123;tool-slug&#125;</span>
              </p>
            </div>
          </div>

          {/* ================================================================ */}
          {/*  Footer CTA                                                      */}
          {/* ================================================================ */}
          <div className="mt-20 mb-8 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-2xl p-8 sm:p-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-4">
              Ready to get discovered?
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Complete your profile, publish your tools, and let SettleGrid&apos;s discovery
              infrastructure do the rest.
            </p>
            <div className="flex flex-wrap justify-center items-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center justify-center bg-brand text-white font-semibold px-8 py-3.5 rounded-lg text-lg hover:bg-brand-dark transition-all shadow-lg shadow-brand/25"
              >
                Create Free Account
              </Link>
              <Link
                href="/learn/handbook"
                className="inline-flex items-center justify-center border-2 border-gray-600 text-gray-300 font-semibold px-8 py-3.5 rounded-lg text-lg hover:border-gray-400 hover:text-white transition-colors"
              >
                Read the Handbook
              </Link>
            </div>
          </div>

        </article>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2E3148] px-6 py-6">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300 transition-colors">
            <SettleGridLogo variant="compact" size={20} />
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/learn" className="hover:text-gray-300 transition-colors">Learn</Link>
            <Link href="/docs" className="hover:text-gray-300 transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
