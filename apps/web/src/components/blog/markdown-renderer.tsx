/**
 * MarkdownRenderer
 *
 * Server component that converts a markdown body to highlighted HTML using
 * the unified pipeline (remark-parse → remark-rehype → rehype-pretty-code →
 * rehype-stringify) and renders the result. Runs entirely server-side, so no
 * markdown or syntax-highlighting JavaScript ships to the client.
 *
 * Used by /learn/blog/[slug] for posts authored as a single markdown body.
 */
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeSlug from 'rehype-slug'
import rehypeAutolinkHeadings from 'rehype-autolink-headings'
import rehypePrettyCode from 'rehype-pretty-code'
import rehypeStringify from 'rehype-stringify'

/**
 * Convert a markdown body string to highlighted HTML.
 *
 * Highlighting uses Shiki via rehype-pretty-code with the github-dark-dimmed
 * theme. The processor is created on each call so heading IDs from rehype-slug
 * remain stable per render and there is no shared mutable state across pages.
 *
 * Exported for use in non-component contexts (tests, search indexing) — the
 * page renderer should prefer the `MarkdownRenderer` component below.
 */
export async function renderMarkdownBody(body: string): Promise<string> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeSlug)
    .use(rehypeAutolinkHeadings, {
      behavior: 'append',
      properties: {
        className: ['heading-anchor'],
        ariaLabel: 'Link to this section',
      },
      content: {
        type: 'element',
        tagName: 'span',
        properties: { className: ['heading-anchor-icon'] },
        children: [{ type: 'text', value: '#' }],
      },
    })
    .use(rehypePrettyCode, {
      theme: 'github-dark-dimmed',
      keepBackground: false,
      defaultLang: 'plaintext',
    })
    .use(rehypeStringify, { allowDangerousHtml: true })

  const file = await processor.process(body)
  return String(file)
}

interface MarkdownRendererProps {
  body: string
}

/**
 * Server component that renders a markdown body as styled HTML inside a
 * scoped wrapper div. Styles for headings, paragraphs, code blocks, tables,
 * lists, and links are applied via the .blog-markdown class in globals.css.
 */
export async function MarkdownRenderer({ body }: MarkdownRendererProps) {
  const html = await renderMarkdownBody(body)
  return (
    <div
      className="blog-markdown"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
