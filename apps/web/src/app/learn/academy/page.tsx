import Link from 'next/link'
import type { Metadata } from 'next'
import { SettleGridLogo } from '@/components/ui/logo'
import { ACADEMY_LESSONS } from '@/lib/academy-lessons'

// ─── Metadata ───────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'SettleGrid Academy — Monetization Lessons for AI Tool Developers',
  description:
    "Long-form lessons on pricing, payment rails, tool-calling economics, and margin math for developers monetizing MCP tools and AI APIs. Citation-heavy, built to stand alone as SEO entry points.",
  alternates: {
    canonical: 'https://settlegrid.ai/learn/academy',
    // RSS auto-discovery: feed readers (Feedly, Inoreader, NetNewsWire,
    // etc.) look for `<link rel="alternate" type="application/rss+xml">`
    // in the page head. Next.js's `alternates.types` field emits
    // exactly that tag. Using `metadata.other` with a custom key
    // like `alternate-rss` produces a `<meta name="alternate-rss">`
    // tag that no reader looks for — auto-discovery would silently
    // not work.
    types: {
      'application/rss+xml':
        'https://settlegrid.ai/learn/academy/rss.xml',
    },
  },
  keywords: [
    'mcp academy',
    'ai tool monetization academy',
    'mcp pricing lessons',
    'ai api pricing lessons',
    'settlegrid academy',
    'mcp monetization tutorial',
  ],
  openGraph: {
    title: 'SettleGrid Academy — Monetization Lessons for AI Tool Developers',
    description:
      'Long-form lessons on pricing, payment rails, tool-calling economics, and margin math for developers monetizing MCP tools and AI APIs.',
    type: 'website',
    url: 'https://settlegrid.ai/learn/academy',
    siteName: 'SettleGrid',
    images: [{ url: 'https://settlegrid.ai/brand/og-image.svg' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SettleGrid Academy',
    description:
      'Long-form lessons on pricing, payment rails, tool-calling economics, and margin math.',
    images: ['https://settlegrid.ai/brand/og-image.svg'],
  },
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Sort lessons by publish date descending so the most recent work is
 * at the top of the landing page. Ties are broken by slug for
 * determinism across builds.
 */
function sortByPublishedDesc(lessons: typeof ACADEMY_LESSONS) {
  return [...lessons].sort((a, b) => {
    const byDate = b.datePublished.localeCompare(a.datePublished)
    return byDate !== 0 ? byDate : a.slug.localeCompare(b.slug)
  })
}

function formatPublishDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function AcademyLandingPage() {
  const lessons = sortByPublishedDesc(ACADEMY_LESSONS)

  // ── JSON-LD: CollectionPage schema ───────────────────────────────────────
  const jsonLdCollection = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'SettleGrid Academy',
    description:
      'Long-form educational content for developers monetizing MCP tools and AI APIs.',
    url: 'https://settlegrid.ai/learn/academy',
    isPartOf: {
      '@type': 'WebSite',
      name: 'SettleGrid',
      url: 'https://settlegrid.ai',
    },
    hasPart: lessons.map((lesson) => ({
      '@type': 'Article',
      headline: lesson.title,
      description: lesson.summary,
      url: lesson.canonicalUrl,
      datePublished: lesson.datePublished,
      dateModified: lesson.dateModified,
      author: { '@type': 'Person', name: lesson.author.name },
    })),
  }

  // ── JSON-LD: BreadcrumbList ─────────────────────────────────────────────
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Learn',
        item: 'https://settlegrid.ai/learn',
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Academy',
        item: 'https://settlegrid.ai/learn/academy',
      },
    ],
  }

  // Same `<` → `\u003c` mitigation used by the [slug] page — a lesson
  // title containing `</script>` must not break out of the embedded
  // script tag during static generation.
  const safe = (obj: unknown): string =>
    JSON.stringify(obj).replace(/</g, '\\u003c')

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/">
            <SettleGridLogo variant="horizontal" size={28} />
          </Link>
          <div className="flex items-center gap-4">
            <Link
              href="/explore"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/learn"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/docs"
              className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-gray-400 hover:text-gray-100"
            >
              Log in
            </Link>
            <Link
              href="/register"
              className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark"
            >
              Sign up
            </Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safe(jsonLdCollection) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: safe(jsonLdBreadcrumb) }}
          />

          {/* Breadcrumb */}
          <nav
            className="flex items-center gap-2 text-sm text-gray-400 mb-8"
            aria-label="Breadcrumb"
          >
            <Link
              href="/learn"
              className="hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100">Academy</span>
          </nav>

          {/* Hero */}
          <div className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                Academy · {lessons.length} lesson
                {lessons.length === 1 ? '' : 's'}
              </span>
              <Link
                href="/learn/academy/rss.xml"
                className="text-[10px] font-medium text-gray-400 hover:text-amber-400 transition-colors inline-flex items-center gap-1"
                aria-label="RSS feed for Academy lessons"
              >
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path d="M3 3c9.94 0 18 8.06 18 18h-3c0-8.28-6.72-15-15-15V3zm0 6c6.63 0 12 5.37 12 12h-3c0-4.97-4.03-9-9-9V9zm0 6c3.31 0 6 2.69 6 6H3v-6z" />
                </svg>
                RSS
              </Link>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              SettleGrid Academy
            </h1>
            <p className="text-lg text-gray-400">
              Long-form lessons on pricing, payment rails, tool-calling
              economics, and margin math for developers monetizing MCP
              tools and AI APIs. Citation-heavy, designed to stand alone
              as SEO entry points.
            </p>
          </div>

          {/* Lesson list */}
          <ul className="space-y-4">
            {lessons.map((lesson) => (
              <li key={lesson.slug}>
                <Link
                  href={`/learn/academy/${lesson.slug}`}
                  className="block bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 hover:border-amber-500/40 transition-colors group"
                >
                  <div className="flex items-center gap-3 mb-2 text-[11px] text-gray-500">
                    <span>{formatPublishDate(lesson.datePublished)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{lesson.readingTime}</span>
                    <span aria-hidden="true">·</span>
                    <span>by {lesson.author.name}</span>
                  </div>
                  <h2 className="text-xl font-bold text-gray-100 mb-2 group-hover:text-amber-400 transition-colors">
                    {lesson.title}
                  </h2>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {lesson.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>

          {/* Footer note */}
          <div className="mt-12 border-t border-[#2A2D3E] pt-8 text-sm text-gray-500">
            <p>
              Follow the Academy via{' '}
              <Link
                href="/learn/academy/rss.xml"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                RSS
              </Link>
              , or keep an eye on{' '}
              <Link
                href="/learn"
                className="text-amber-400 hover:text-amber-300 transition-colors"
              >
                /learn
              </Link>{' '}
              for the full catalog of guides, tutorials, and blog posts.
            </p>
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="border-t border-[#2A2D3E] px-6 py-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <SettleGridLogo variant="compact" size={32} />
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link
              href="/explore"
              className="hover:text-gray-100 transition-colors"
            >
              Explore
            </Link>
            <Link
              href="/learn"
              className="hover:text-gray-100 transition-colors"
            >
              Learn
            </Link>
            <Link
              href="/docs"
              className="hover:text-gray-100 transition-colors"
            >
              Docs
            </Link>
            <Link
              href="/privacy"
              className="hover:text-gray-100 transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/terms"
              className="hover:text-gray-100 transition-colors"
            >
              Terms
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} SettleGrid. All rights
            reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
