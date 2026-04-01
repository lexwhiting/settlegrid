/**
 * settlegrid-fax-api — Fax Document Formatter MCP Server
 *
 * Formats documents for fax transmission with cover pages
 * and standard fax header/footer formatting.
 *
 * Methods:
 *   generate_cover_page(to, from, subject)   — Generate cover page  (1c)
 *   format_document(text, options)            — Format for fax       (1c)
 *   get_country_codes()                       — Get fax country codes (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface CoverPageInput { to: string; from: string; subject: string; pages?: number; message?: string; company?: string; urgent?: boolean }
interface FormatInput { text: string; header?: string; footer?: string; page_numbers?: boolean }

const COUNTRY_CODES: Array<{ country: string; code: string; format: string }> = [
  { country: 'United States', code: '+1', format: '+1-XXX-XXX-XXXX' },
  { country: 'United Kingdom', code: '+44', format: '+44-XXXX-XXXXXX' },
  { country: 'Germany', code: '+49', format: '+49-XXXX-XXXXXXX' },
  { country: 'France', code: '+33', format: '+33-X-XX-XX-XX-XX' },
  { country: 'Japan', code: '+81', format: '+81-XX-XXXX-XXXX' },
  { country: 'Australia', code: '+61', format: '+61-X-XXXX-XXXX' },
  { country: 'Canada', code: '+1', format: '+1-XXX-XXX-XXXX' },
  { country: 'Italy', code: '+39', format: '+39-XXX-XXXXXXX' },
  { country: 'China', code: '+86', format: '+86-XXX-XXXX-XXXX' },
  { country: 'India', code: '+91', format: '+91-XXXX-XXXXXX' },
]

const sg = settlegrid.init({
  toolSlug: 'fax-api',
  pricing: { defaultCostCents: 1, methods: {
    generate_cover_page: { costCents: 1, displayName: 'Generate Cover Page' },
    format_document: { costCents: 1, displayName: 'Format Document' },
    get_country_codes: { costCents: 1, displayName: 'Get Country Codes' },
  }},
})

const generateCoverPage = sg.wrap(async (args: CoverPageInput) => {
  if (!args.to || !args.from || !args.subject) throw new Error('to, from, and subject required')
  const date = new Date().toISOString().slice(0, 10)
  const urgentLine = args.urgent ? '\n*** URGENT ***\n' : ''
  const cover = [
    '═'.repeat(60),
    '                     FAX COVER SHEET',
    '═'.repeat(60),
    urgentLine,
    `Date:     ${date}`,
    `To:       ${args.to}`,
    `From:     ${args.from}`,
    args.company ? `Company:  ${args.company}` : '',
    `Subject:  ${args.subject}`,
    `Pages:    ${args.pages ?? 1} (including cover)`,
    '',
    '─'.repeat(60),
    'Message:',
    args.message ?? '(No message)',
    '',
    '─'.repeat(60),
    'CONFIDENTIALITY NOTICE: This fax is intended only for the',
    'named recipient. If received in error, please notify the',
    'sender and destroy all copies.',
    '═'.repeat(60),
  ].filter(Boolean).join('\n')
  return { cover_page: cover, pages: args.pages ?? 1, date, char_count: cover.length }
}, { method: 'generate_cover_page' })

const formatDocument = sg.wrap(async (args: FormatInput) => {
  if (!args.text) throw new Error('text required')
  const lines = args.text.split('\n')
  const linesPerPage = 55
  const pages: string[] = []
  for (let i = 0; i < lines.length; i += linesPerPage) {
    const pageLines = lines.slice(i, i + linesPerPage)
    const pageNum = Math.floor(i / linesPerPage) + 1
    const header = args.header ?? ''
    const footer = args.page_numbers ? `Page ${pageNum}` : (args.footer ?? '')
    pages.push([header, '', ...pageLines, '', footer].join('\n'))
  }
  return { pages: pages.length, formatted: pages.join('\n\n--- PAGE BREAK ---\n\n'), total_lines: lines.length }
}, { method: 'format_document' })

const getCountryCodes = sg.wrap(async (_a: Record<string, never>) => {
  return { codes: COUNTRY_CODES, count: COUNTRY_CODES.length }
}, { method: 'get_country_codes' })

export { generateCoverPage, formatDocument, getCountryCodes }
console.log('settlegrid-fax-api MCP server ready')
console.log('Methods: generate_cover_page, format_document, get_country_codes')
console.log('Pricing: 1c per call | Powered by SettleGrid')
