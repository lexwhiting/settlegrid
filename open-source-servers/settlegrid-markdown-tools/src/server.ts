/**
 * settlegrid-markdown-tools — Markdown Tools MCP Server
 *
 * Converts markdown locally with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   md_to_html(markdown) — convert to HTML (1¢)
 *   extract_md_links(markdown) — extract links (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface MdInput { markdown: string }

const sg = settlegrid.init({
  toolSlug: 'markdown-tools',
  pricing: { defaultCostCents: 1, methods: { md_to_html: { costCents: 1, displayName: 'MD to HTML' }, extract_md_links: { costCents: 1, displayName: 'Extract Links' } } },
})

function simpleMarkdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/^(?!<[hla]|<li)(.+)$/gm, '<p>$1</p>')
    .replace(/\n\n/g, '\n')
}

const mdToHtml = sg.wrap(async (args: MdInput) => {
  if (!args.markdown) throw new Error('markdown is required')
  const html = simpleMarkdownToHtml(args.markdown)
  return { html, input_length: args.markdown.length, output_length: html.length }
}, { method: 'md_to_html' })

const extractMdLinks = sg.wrap(async (args: MdInput) => {
  if (!args.markdown) throw new Error('markdown is required')
  const linkRegex = /\[([^\]]+)\]\(([^)]+)\)/g
  const links: Array<{ text: string; url: string }> = []
  let match
  while ((match = linkRegex.exec(args.markdown)) !== null) {
    links.push({ text: match[1], url: match[2] })
  }
  const headingRegex = /^(#{1,6})\s+(.+)$/gm
  const headings: Array<{ level: number; text: string }> = []
  while ((match = headingRegex.exec(args.markdown)) !== null) {
    headings.push({ level: match[1].length, text: match[2] })
  }
  return { links, headings, link_count: links.length, heading_count: headings.length }
}, { method: 'extract_md_links' })

export { mdToHtml, extractMdLinks }

console.log('settlegrid-markdown-tools MCP server ready')
console.log('Methods: md_to_html, extract_md_links')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
