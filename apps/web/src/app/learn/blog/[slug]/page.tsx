import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SettleGridLogo } from '@/components/ui/logo'
import { BLOG_POSTS, BLOG_SLUGS, getBlogPostBySlug } from '@/lib/blog-posts'

// ─── Static Generation ──────────────────────────────────────────────────────

export function generateStaticParams() {
  return BLOG_SLUGS.map((slug) => ({ slug }))
}

// ─── Metadata ───────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)
  if (!post) return { title: 'Post Not Found | SettleGrid' }

  const title = `${post.title} | SettleGrid`

  return {
    title,
    description: post.description,
    alternates: { canonical: `https://settlegrid.ai/learn/blog/${slug}` },
    keywords: post.keywords,
    openGraph: {
      title,
      description: post.description,
      type: 'article',
      url: `https://settlegrid.ai/learn/blog/${slug}`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: post.description,
    },
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Renders paragraph text with inline `code` spans.
 * Splits on backtick-delimited segments and wraps code in <code>.
 */
function renderParagraph(text: string, keyPrefix: string) {
  const parts = text.split(/(`[^`]+`)/)
  return parts.map((part, i) => {
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={`${keyPrefix}-${i}`}
          className="bg-[#0D1117] text-amber-400 text-sm px-1.5 py-0.5 rounded font-mono"
        >
          {part.slice(1, -1)}
        </code>
      )
    }
    return <span key={`${keyPrefix}-${i}`}>{part}</span>
  })
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = getBlogPostBySlug(slug)
  if (!post) notFound()

  // Related posts
  const relatedPosts = post.relatedSlugs
    .map((s) => BLOG_POSTS.find((p) => p.slug === s))
    .filter(Boolean) as typeof BLOG_POSTS

  // ── JSON-LD: Article schema ──────────────────────────────────────────────
  const jsonLdArticle = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.description,
    url: `https://settlegrid.ai/learn/blog/${slug}`,
    datePublished: post.datePublished,
    dateModified: post.dateModified,
    wordCount: post.wordCount,
    keywords: post.keywords,
    articleSection: 'Developer Guides',
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
    mainEntityOfPage: `https://settlegrid.ai/learn/blog/${slug}`,
  }

  // ── JSON-LD: BreadcrumbList ─────────────────────────────────────────────
  const jsonLdBreadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Learn', item: 'https://settlegrid.ai/learn' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: 'https://settlegrid.ai/learn/blog' },
      { '@type': 'ListItem', position: 3, name: post.title, item: `https://settlegrid.ai/learn/blog/${slug}` },
    ],
  }

  return (
    <div className="dark min-h-screen flex flex-col bg-[#0C0E14] text-gray-100">
      {/* ---- Header ---- */}
      <header className="border-b border-[#2A2D3E] px-6 py-4 bg-[#0C0E14]/80 backdrop-blur-lg sticky top-0 z-50">
        <nav className="max-w-5xl mx-auto flex items-center justify-between">
          <Link href="/"><SettleGridLogo variant="horizontal" size={28} /></Link>
          <div className="flex items-center gap-4">
            <Link href="/explore" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Learn</Link>
            <Link href="/docs" className="text-sm font-medium text-gray-400 hover:text-gray-100 transition-colors">Docs</Link>
            <Link href="/login" className="text-sm font-medium text-gray-400 hover:text-gray-100">Log in</Link>
            <Link href="/register" className="text-sm font-medium bg-brand text-white px-4 py-2 rounded-lg hover:bg-brand-dark">Sign up</Link>
          </div>
        </nav>
      </header>

      {/* ---- Main ---- */}
      <main className="flex-1 px-6 py-12">
        <div className="max-w-3xl mx-auto">
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdArticle) }} />
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdBreadcrumb) }} />

          {/* Breadcrumb */}
          <nav className="flex items-center gap-2 text-sm text-gray-400 mb-8" aria-label="Breadcrumb">
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
            <span aria-hidden="true">/</span>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Blog</Link>
            <span aria-hidden="true">/</span>
            <span className="text-gray-100 truncate max-w-[200px]">{post.title.split(':')[0]}</span>
          </nav>

          {/* Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full px-2 py-0.5">
                {post.readingTime}
              </span>
              <span className="text-[10px] text-gray-500">
                {new Date(post.datePublished).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-gray-100 mb-4">
              {post.title}
            </h1>
            <p className="text-lg text-gray-400">
              {post.description}
            </p>
          </div>

          {/* Table of Contents */}
          <div className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-6 mb-12">
            <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-3">
              In this article
            </h2>
            <ol className="space-y-1.5">
              {post.sections.map((section, i) => (
                <li key={section.id}>
                  <a
                    href={`#${section.id}`}
                    className="text-sm text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    {i + 1}. {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </div>

          {/* Sections */}
          <div className="space-y-14">
            {post.sections.map((section, i) => (
              <section key={section.id} id={section.id}>
                <div className="flex items-baseline gap-3 mb-4 scroll-mt-24">
                  <span className="flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 text-sm font-bold shrink-0">
                    {i + 1}
                  </span>
                  <h2 className="text-xl font-bold text-gray-100">
                    {section.heading}
                  </h2>
                </div>

                {/* Content paragraphs */}
                <div className="space-y-4 pl-11">
                  {section.content.split('\n\n').map((paragraph, j) => (
                    <p key={j} className="text-gray-300 leading-relaxed">
                      {renderParagraph(paragraph, `s-${i}-p-${j}`)}
                    </p>
                  ))}
                </div>

                {/* Optional comparison table */}
                {section.tableHeaders && section.tableRows && (
                  <div className="pl-11 mt-6 overflow-x-auto">
                    <table className="w-full text-sm border border-[#2A2D3E] rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-[#161822] text-left">
                          {section.tableHeaders.map((header) => (
                            <th key={header} className="py-3 px-4 font-semibold text-gray-200 whitespace-nowrap">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#2A2D3E]/50">
                        {section.tableRows.map((row, ri) => (
                          <tr key={ri}>
                            {row.map((cell, ci) => (
                              <td
                                key={ci}
                                className={`py-3 px-4 ${ci === 0 ? 'font-medium text-gray-200' : 'text-gray-400'} whitespace-nowrap`}
                              >
                                {cell}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-14 mb-10 rounded-xl border border-[#2A2D3E] bg-gradient-to-br from-[#161822] to-[#0C0E14] p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-100 mb-3">
              Ready to monetize your MCP tools?
            </h2>
            <p className="text-gray-400 mb-6 max-w-lg mx-auto">
              Two lines of code. 10 payment protocols. Up to 100% revenue share. Start earning from your AI tools today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/docs"
                className="inline-flex items-center bg-brand text-white px-6 py-3 rounded-lg font-semibold hover:bg-brand-dark transition-colors shadow-sm shadow-brand/25"
              >
                Read the Docs
              </Link>
              <Link
                href="/register"
                className="inline-flex items-center bg-[#161822] text-amber-400 border border-amber-500/30 px-6 py-3 rounded-lg font-semibold hover:border-amber-500/60 transition-colors"
              >
                Sign Up Free
              </Link>
            </div>
          </div>

          {/* Related Posts */}
          {relatedPosts.length > 0 && (
            <div className="mb-10">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Related Articles</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {relatedPosts.map((related) => (
                  <Link
                    key={related.slug}
                    href={`/learn/blog/${related.slug}`}
                    className="bg-[#161822] rounded-xl border border-[#2A2D3E] p-5 hover:border-amber-500/40 transition-colors group"
                  >
                    <p className="text-xs text-gray-500 mb-1">{related.readingTime}</p>
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
            <Link href="/explore" className="hover:text-gray-100 transition-colors">Explore</Link>
            <Link href="/learn" className="hover:text-gray-100 transition-colors">Learn</Link>
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
