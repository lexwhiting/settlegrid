import { describe, it, expect } from 'vitest'
import {
  ACADEMY_LESSONS,
  ACADEMY_SLUGS,
  getAcademyLessonBySlug,
} from '../academy-lessons'
import { wordCountFromMarkdown } from '../blog-posts'

describe('ACADEMY_LESSONS registry', () => {
  it('has at least one lesson (Phase 3 launch lesson 1)', () => {
    expect(ACADEMY_LESSONS.length).toBeGreaterThanOrEqual(1)
  })

  it('every lesson has a unique slug', () => {
    const slugs = ACADEMY_LESSONS.map((l) => l.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('every slug matches the URL-safe shape /^[a-z0-9-]+$/', () => {
    for (const l of ACADEMY_LESSONS) {
      expect(l.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('ACADEMY_SLUGS mirrors the lesson list', () => {
    expect(ACADEMY_SLUGS).toEqual(ACADEMY_LESSONS.map((l) => l.slug))
  })
})

describe('getAcademyLessonBySlug', () => {
  it('returns the lesson for a known slug', () => {
    const l = getAcademyLessonBySlug('pricing-your-mcp-server')
    expect(l).toBeDefined()
    expect(l?.title).toMatch(/Price Your MCP Server/i)
  })

  it('returns undefined for an unknown slug', () => {
    expect(getAcademyLessonBySlug('does-not-exist')).toBeUndefined()
  })
})

describe('lesson: pricing-your-mcp-server', () => {
  const lesson = getAcademyLessonBySlug('pricing-your-mcp-server')!

  it('has all required metadata fields populated', () => {
    expect(lesson.title).toBeTruthy()
    expect(lesson.summary).toBeTruthy()
    expect(lesson.datePublished).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(lesson.dateModified).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(lesson.readingTime).toBeTruthy()
    expect(lesson.author.name).toBeTruthy()
    expect(lesson.canonicalUrl).toMatch(
      /^https:\/\/settlegrid\.ai\/learn\/academy\//,
    )
    expect(lesson.keywords.length).toBeGreaterThanOrEqual(3)
    // Spec says SEO targets: "how to price mcp server", "mcp server
    // pricing", "ai tool pricing". Keywords should cover all three
    // semantic targets (substring match — keyword variants OK).
    const joined = lesson.keywords.join(' ').toLowerCase()
    expect(joined).toMatch(/mcp server pricing|price.*mcp.*server/)
    expect(joined).toMatch(/ai.*tool.*pricing|ai.*pricing/)
  })

  it('body is non-empty and between 3000 and 5000 words (spec floor + ceiling)', () => {
    expect(lesson.body).toBeTruthy()
    expect(lesson.body.length).toBeGreaterThan(10_000)
    const wc = wordCountFromMarkdown(lesson.body)
    expect(wc).toBeGreaterThanOrEqual(3000)
    expect(wc).toBeLessThanOrEqual(5000)
  })

  it('body uses proper H2 structure (at least 6 top-level sections for TOC)', () => {
    const h2Count = (lesson.body.match(/^##\s+/gm) ?? []).length
    expect(h2Count).toBeGreaterThanOrEqual(6)
  })

  it('contains at least 3 internal links (blog posts or shadow directory)', () => {
    // Match markdown links whose target begins with /learn/blog/ or /mcp
    const internalLinks = [
      ...lesson.body.matchAll(/\]\((\/(?:learn\/blog|mcp)[^)]*)\)/g),
    ]
    expect(internalLinks.length).toBeGreaterThanOrEqual(3)
  })

  it('cites competitor/ecosystem pricing with external links (no bare figures)', () => {
    // Spec + hostile audit: "no hallucinated pricing from real
    // competitors — every benchmark has a citation link". The body
    // must link out to Anthropic, OpenAI, and Stripe so every
    // citable pricing claim can be verified.
    expect(lesson.body).toMatch(/\]\(https:\/\/claude\.com\/pricing\)/)
    expect(lesson.body).toMatch(/\]\(https:\/\/openai\.com\/api\/pricing\)/)
    expect(lesson.body).toMatch(/\]\(https:\/\/stripe\.com\/pricing\)/)
  })

  it('does not stuff the primary keyword into every paragraph', () => {
    // Heuristic hostile check: count paragraphs (double-newline
    // separated) that contain the literal primary keyword phrase.
    // If >50% of paragraphs contain the literal phrase, it's stuffing.
    const paragraphs = lesson.body
      .split(/\n\n/)
      .filter((p) => p.trim().length > 0)
    const primary = 'mcp server pricing'
    const hits = paragraphs.filter((p) =>
      p.toLowerCase().includes(primary),
    ).length
    expect(hits / paragraphs.length).toBeLessThan(0.5)
  })
})
