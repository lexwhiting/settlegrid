import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { MarkdownRenderer } from '@/components/blog/markdown-renderer'
import { safeJsonLd } from '@/lib/json-ld'
import {
  ACADEMY_LESSONS,
  ACADEMY_SLUGS,
  getAcademyLessonBySlug,
} from '@/lib/academy-lessons'
import {
  extractTocFromMarkdown,
  wordCountFromMarkdown,
} from '@/lib/blog-posts'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return ACADEMY_SLUGS.map((slug) => ({ slug }))
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const lesson = getAcademyLessonBySlug(slug)
  if (!lesson) return { title: 'Lesson Not Found | SettleGrid' }

  const title = `${lesson.title} | SettleGrid Academy`

  // Fall back to the site-wide OG card when a lesson doesn't ship its
  // own. Twitter's `summary_large_image` card requires an image URL —
  // omitting it makes Twitter silently drop the card or fall back to
  // the smaller `summary` variant, which undercuts the SEO goal of
  // the Academy.
  const DEFAULT_OG_IMAGE = 'https://settlegrid.ai/brand/og-image.svg'
  const ogImage = lesson.ogImage ?? DEFAULT_OG_IMAGE

  return {
    title,
    description: lesson.summary,
    alternates: { canonical: lesson.canonicalUrl },
    keywords: lesson.keywords,
    openGraph: {
      title,
      description: lesson.summary,
      type: 'article',
      url: lesson.canonicalUrl,
      siteName: 'SettleGrid',
      publishedTime: lesson.datePublished,
      modifiedTime: lesson.dateModified,
      authors: [lesson.author.name],
      section: 'Monetization Academy',
      images: [{ url: ogImage }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: lesson.summary,
      images: [ogImage],
    },
    other: {
      'article:published_time': lesson.datePublished,
      'article:modified_time': lesson.dateModified,
      'article:author': lesson.author.name,
    },
  }
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function AcademyLessonPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const lesson = getAcademyLessonBySlug(slug)
  if (!lesson) notFound()

  const tocEntries = extractTocFromMarkdown(lesson.body)

  // Prefer the computed count so the JSON-LD stays honest as the body
  // gets edited. Authors can still override via `wordCount` if they
  // want a stable number.
  const articleWordCount = lesson.wordCount ?? wordCountFromMarkdown(lesson.body)

  const relatedLessons = lesson.relatedSlugs
    .map((s) => ACADEMY_LESSONS.find((l) => l.slug === s))
    .filter(Boolean) as typeof ACADEMY_LESSONS

  // ── JSON-LD: Article schema ────────────────────────────────────────────
  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: lesson.title,
    description: lesson.summary,
    url: lesson.canonicalUrl,
    datePublished: lesson.datePublished,
    dateModified: lesson.dateModified,
    wordCount: articleWordCount,
    keywords: lesson.keywords,
    articleSection: 'Monetization Academy',
    author: {
      '@type': 'Person',
      name: lesson.author.name,
      ...(lesson.author.url ? { url: lesson.author.url } : {}),
      ...(lesson.author.bio ? { description: lesson.author.bio } : {}),
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
    mainEntityOfPage: lesson.canonicalUrl,
  }

  // ── JSON-LD: BreadcrumbList ─────────────────────────────────────────
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
      {
        '@type': 'ListItem',
        position: 3,
        name: lesson.title,
        item: lesson.canonicalUrl,
      },
    ],
  }

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
            dangerouslySetInnerHTML={{
              __html: safeJsonLd(jsonLdArticle),
            }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: safeJsonLd(jsonLdBreadcrumb),
            }}
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
            <span className="text-gray-400">Academy</span>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100 truncate max-w-[240px]">
              {lesson.title.split(':')[0]}
            </span>
          </nav>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                Academy · Lesson 1
              </span>
              <span className="text-[10px] text-gray-500">
                {lesson.readingTime}
              </span>
              <span className="text-[10px] text-gray-500">
                {new Date(lesson.datePublished).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </span>
              <span className="text-[10px] text-gray-500">
                {'by '}
                {lesson.author.url ? (
                  <a
                    href={lesson.author.url}
                    className="text-gray-400 hover:text-gray-100 transition-colors"
                  >
                    {lesson.author.name}
                  </a>
                ) : (
                  lesson.author.name
                )}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              {lesson.title}
            </h1>
            <p className="text-lg text-gray-400">{lesson.summary}</p>
          </div>

          {/* Table of Contents */}
          {tocEntries.length > 0 && (
            <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12">
              <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
                In this lesson
              </h2>
              <ol className="space-y-1.5">
                {tocEntries.map((entry, i) => (
                  <li key={entry.id}>
                    <a
                      href={`#${entry.id}`}
                      className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                    >
                      {i + 1}. {entry.heading}
                    </a>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Body */}
          <MarkdownRenderer body={lesson.body} />

          {/* CTA */}
          <div className="mt-14 mb-10 rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Ready to put a price on your MCP tool?
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              SettleGrid lets you try any pricing model — per-call,
              tiered, freemium — with two lines of code, and switch
              without redeploying. Free tier is production-ready:
              50K operations/month, 0% take rate on your first
              $1K/mo of revenue.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/register"
                className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Start Pricing Experiments
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center bg-[#161822] text-amber-400 border border-amber-500/30 px-6 py-3 rounded-lg font-semibold hover:border-amber-500/60 transition-colors"
              >
                Read the Pricing Docs
              </Link>
            </div>
          </div>

          {/* Related lessons */}
          {relatedLessons.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">
                More lessons
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedLessons.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/learn/academy/${related.slug}`}
                    className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
                  >
                    <p className="text-xs text-gray-500 mb-1">
                      {related.readingTime}
                    </p>
                    <p className="font-semibold text-gray-100 group-hover:text-amber-400 transition-colors text-sm leading-snug">
                      {related.title}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}
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
