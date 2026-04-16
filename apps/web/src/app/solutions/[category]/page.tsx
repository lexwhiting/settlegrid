import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { getCategoryBySlug } from '@/lib/categories'
import { SOLUTIONS, SOLUTION_SLUGS, getSolutionBySlug } from '@/lib/solutions'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return SOLUTION_SLUGS.map((category) => ({ category }))
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>
}): Promise<Metadata> {
  const { category } = await params
  const solution = getSolutionBySlug(category)
  if (!solution) notFound()

  const cat = getCategoryBySlug(category)
  const title = `${solution.headline} | SettleGrid`
  const description = solution.subtext

  return {
    title,
    description,
    alternates: { canonical: `https://settlegrid.ai/solutions/${category}` },
    keywords: solution.keywords,
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://settlegrid.ai/solutions/${category}`,
      siteName: 'SettleGrid',
    },
    twitter: {
      card: 'summary_large_image',
      title: cat?.name ? `${cat.name} Billing | SettleGrid` : title,
      description,
    },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function SolutionPage({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  const solution = getSolutionBySlug(category)
  if (!solution) notFound()

  const cat = getCategoryBySlug(category)

  // Find adjacent solutions for navigation
  const solutionIndex = SOLUTIONS.findIndex((s) => s.slug === category)
  const prevSolution = solutionIndex > 0 ? SOLUTIONS[solutionIndex - 1] : SOLUTIONS[SOLUTIONS.length - 1]
  const nextSolution = solutionIndex < SOLUTIONS.length - 1 ? SOLUTIONS[solutionIndex + 1] : SOLUTIONS[0]

  const jsonLdApp = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: `SettleGrid ${cat?.name ?? 'AI Service'} Billing`,
    description: solution.subtext,
    url: `https://settlegrid.ai/solutions/${category}`,
    applicationCategory: 'DeveloperApplication',
    operatingSystem: 'Any',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: `${solution.billingModel} billing for ${cat?.name ?? 'AI services'}`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
  }

  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Solutions', item: 'https://settlegrid.ai/solutions' },
      { '@type': 'ListItem', position: 2, name: cat?.name ?? category, item: `https://settlegrid.ai/solutions/${category}` },
    ],
  }

  const jsonLdFaq = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: solution.faqEntries.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#161822]">
        <nav className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/solutions" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Solutions</Link>
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      <main className="flex-1 px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdApp) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFaq) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/solutions" className="hover:text-gray-100 transition-colors">Solutions</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">{cat?.name ?? category}</span>
          </nav>

          {/* ── Section 1: Hero ────────────────────────────────────────────── */}
          <section className="mb-16">
            <div className="flex items-center gap-3 mb-6">
              {cat && (
                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${cat.color}`}>
                  {solution.billingModel}
                </span>
              )}
              <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                {solution.tam}
              </span>
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-100 mb-6 leading-tight">
              {solution.headline}
            </h1>
            <p className="text-xl text-gray-400 max-w-3xl leading-relaxed">
              {solution.subtext}
            </p>
            <div className="flex flex-col sm:flex-row items-start gap-4 mt-8">
              <Link
                href="/register"
                className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Building -- Free
              </Link>
              <Link
                href="/docs"
                className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
              >
                Read the Docs
              </Link>
            </div>
          </section>

          {/* ── Section 2: Code Example ────────────────────────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">
              How it works
            </h2>
            <div className="bg-[#0A0C12] rounded-xl border border-[#2A2D3E] overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A2D3E]">
                <div className="w-3 h-3 rounded-full bg-red-500/60" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <div className="w-3 h-3 rounded-full bg-green-500/60" />
                <span className="ml-2 text-xs text-gray-500 font-mono">TypeScript</span>
              </div>
              <pre className="p-6 overflow-x-auto text-sm leading-relaxed">
                <code className="text-gray-300 font-mono whitespace-pre">{solution.codeExample}</code>
              </pre>
            </div>
          </section>

          {/* ── Section 3: Provider Table ──────────────────────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-2">
              Supported providers
            </h2>
            <p className="text-gray-400 mb-6">
              SettleGrid works with any provider. Here are the most common ones for {cat?.name?.toLowerCase() ?? 'this category'}.
            </p>
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#2A2D3E]">
                    <th className="text-left text-sm font-semibold text-gray-400 px-6 py-4">Provider</th>
                    <th className="text-left text-sm font-semibold text-gray-400 px-6 py-4">Pricing</th>
                  </tr>
                </thead>
                <tbody>
                  {solution.providers.map((provider, i) => (
                    <tr key={provider.name} className={i < solution.providers.length - 1 ? 'border-b border-[#252836]' : ''}>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-100">{provider.name}</span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        {provider.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── Section 4: Billing Model Explanation ───────────────────────── */}
          <section className="mb-16">
            <div className="bg-gradient-to-br from-[#161822] to-[#0C0E14] rounded-xl border border-[#2A2D3E] p-8 sm:p-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="inline-flex items-center rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">
                  Billing model: {solution.billingModel}
                </span>
              </div>
              <h2 className="text-2xl font-bold text-gray-100 mb-4">
                Why {solution.billingModel} billing?
              </h2>
              <p className="text-gray-400 leading-relaxed text-lg">
                {solution.billingModelExplanation}
              </p>
            </div>
          </section>

          {/* ── Section 5: TAM & Market ────────────────────────────────────── */}
          <section className="mb-16">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 text-center">
                <p className="text-3xl font-bold text-amber-400 mb-2">{solution.tam.split(' ')[0]}</p>
                <p className="text-sm text-gray-400">Total Addressable Market</p>
              </div>
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 text-center">
                <p className="text-3xl font-bold text-amber-400 mb-2">{solution.providers.length}</p>
                <p className="text-sm text-gray-400">Supported Providers</p>
              </div>
              <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 text-center">
                <p className="text-3xl font-bold text-amber-400 mb-2">2 min</p>
                <p className="text-sm text-gray-400">Setup Time</p>
              </div>
            </div>
          </section>

          {/* ── Section 6: FAQ ─────────────────────────────────────────────── */}
          <section className="mb-16">
            <h2 className="text-2xl font-bold text-gray-100 mb-6">
              Frequently asked questions
            </h2>
            <div className="space-y-4">
              {solution.faqEntries.map((faq) => (
                <details
                  key={faq.q}
                  className="group bg-[#161822] rounded-xl border border-[#2A2D3E] overflow-hidden"
                >
                  <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none">
                    <span className="font-semibold text-gray-100 pr-4">{faq.q}</span>
                    <svg
                      className="w-5 h-5 text-gray-400 shrink-0 transition-transform group-open:rotate-180"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      aria-hidden="true"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5 text-gray-400 leading-relaxed">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </section>

          {/* ── Section 7: CTA ─────────────────────────────────────────────── */}
          <section className="mb-16">
            <div className="rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-12 text-center">
              <h2 className="text-2xl sm:text-3xl font-bold text-gray-100 mb-3">
                Start billing {cat?.name?.toLowerCase() ?? 'AI services'} today
              </h2>
              <p className="text-gray-400 mb-8 max-w-lg mx-auto">
                Add {solution.billingModel} billing to your {cat?.name?.toLowerCase() ?? 'AI'} service in under 2 minutes. No upfront costs, no contracts.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link
                  href="/register"
                  className="bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
                >
                  Start Building -- Free
                </Link>
                <Link
                  href="/docs"
                  className="text-gray-400 hover:text-gray-100 px-6 py-3 rounded-lg font-medium border border-[#2A2D3E] hover:border-gray-500 transition-colors"
                >
                  Read the Docs
                </Link>
              </div>
            </div>
          </section>

          {/* ── Adjacent Solutions ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link
              href={`/solutions/${prevSolution.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
            >
              <p className="text-xs text-gray-500 mb-1">&larr; Previous solution</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {getCategoryBySlug(prevSolution.slug)?.name ?? prevSolution.slug}
              </p>
            </Link>
            <Link
              href={`/solutions/${nextSolution.slug}`}
              className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group text-right"
            >
              <p className="text-xs text-gray-500 mb-1">Next solution &rarr;</p>
              <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors">
                {getCategoryBySlug(nextSolution.slug)?.name ?? nextSolution.slug}
              </p>
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/solutions" className="hover:text-gray-100 transition-colors">Solutions</Link>
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/docs" className="hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/privacy" className="hover:text-gray-100 transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-gray-100 transition-colors">Terms</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} SettleGrid. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
