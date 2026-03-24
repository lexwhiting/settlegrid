/**
 * settlegrid-chat-format — Message Formatting MCP Server
 *
 * Local conversion — no external API needed.
 *
 * Methods:
 *   to_markdown(text)      — Convert plain text to Markdown   (1¢)
 *   to_html(markdown)      — Convert Markdown to HTML         (1¢)
 *   to_plaintext(html)     — Strip HTML to plain text         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TextInput {
  text: string
}

interface MarkdownInput {
  markdown: string
}

interface HtmlInput {
  html: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MAX_SIZE = 100000

function validateInput(val: unknown, name: string): string {
  if (!val || typeof val !== 'string') throw new Error(`${name} is required`)
  if (val.length > MAX_SIZE) throw new Error(`${name} too large (max ${MAX_SIZE} chars)`)
  return val
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function markdownToHtml(md: string): string {
  let html = md

  // Headers
  html = html.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>')
  html = html.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>')
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>')
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>')

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>')
  html = html.replace(/_(.+?)_/g, '<em>$1</em>')

  // Code blocks
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Links and images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')

  // Lists
  html = html.replace(/^\*\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^-\s+(.+)$/gm, '<li>$1</li>')
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>')

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />')

  // Line breaks and paragraphs
  html = html.replace(/\n\n/g, '</p><p>')
  html = html.replace(/\n/g, '<br />')
  html = `<p>${html}</p>`

  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '')
  html = html.replace(/<p>(<h[1-6]>)/g, '$1')
  html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1')
  html = html.replace(/<p>(<pre>)/g, '$1')
  html = html.replace(/(<\/pre>)<\/p>/g, '$1')
  html = html.replace(/<p>(<hr \/>)/g, '$1')
  html = html.replace(/(<hr \/>)<\/p>/g, '$1')

  return html
}

function htmlToPlaintext(html: string): string {
  let text = html

  // Convert block elements to newlines
  text = text.replace(/<br\s*\/?>/gi, '\n')
  text = text.replace(/<\/p>/gi, '\n\n')
  text = text.replace(/<\/div>/gi, '\n')
  text = text.replace(/<\/h[1-6]>/gi, '\n\n')
  text = text.replace(/<\/li>/gi, '\n')
  text = text.replace(/<li[^>]*>/gi, '  - ')
  text = text.replace(/<hr\s*\/?>/gi, '\n---\n')

  // Convert links
  text = text.replace(/<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, '')

  // Decode HTML entities
  text = text.replace(/&amp;/g, '&')
  text = text.replace(/&lt;/g, '<')
  text = text.replace(/&gt;/g, '>')
  text = text.replace(/&quot;/g, '"')
  text = text.replace(/&#39;/g, "'")
  text = text.replace(/&nbsp;/g, ' ')

  // Clean up whitespace
  text = text.replace(/\n{3,}/g, '\n\n')
  text = text.trim()

  return text
}

function textToMarkdown(text: string): string {
  let md = text

  // Detect and convert URLs to links
  md = md.replace(/(https?:\/\/[^\s]+)/g, '[$1]($1)')

  // Detect and convert email addresses
  md = md.replace(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, '[$1](mailto:$1)')

  // Preserve line breaks
  md = md.replace(/\n/g, '  \n')

  return md
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'chat-format',
  pricing: {
    defaultCostCents: 1,
    methods: {
      to_markdown: { costCents: 1, displayName: 'To Markdown' },
      to_html: { costCents: 1, displayName: 'To HTML' },
      to_plaintext: { costCents: 1, displayName: 'To Plain Text' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const toMarkdown = sg.wrap(async (args: TextInput) => {
  const text = validateInput(args.text, 'text')
  const markdown = textToMarkdown(text)

  return {
    input: text.slice(0, 100),
    markdown,
    inputLength: text.length,
    outputLength: markdown.length,
  }
}, { method: 'to_markdown' })

const toHtml = sg.wrap(async (args: MarkdownInput) => {
  const markdown = validateInput(args.markdown, 'markdown')
  const html = markdownToHtml(markdown)

  return {
    input: markdown.slice(0, 100),
    html,
    inputLength: markdown.length,
    outputLength: html.length,
  }
}, { method: 'to_html' })

const toPlaintext = sg.wrap(async (args: HtmlInput) => {
  const html = validateInput(args.html, 'html')
  const plaintext = htmlToPlaintext(html)

  return {
    input: html.slice(0, 100),
    plaintext,
    inputLength: html.length,
    outputLength: plaintext.length,
    tagsStripped: (html.match(/<[^>]+>/g) || []).length,
  }
}, { method: 'to_plaintext' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { toMarkdown, toHtml, toPlaintext }

console.log('settlegrid-chat-format MCP server ready')
console.log('Methods: to_markdown, to_html, to_plaintext')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
