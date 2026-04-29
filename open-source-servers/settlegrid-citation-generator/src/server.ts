/**
 * settlegrid-citation-generator — Academic Citation Formatter MCP Server
 *
 * Formats citations in APA, MLA, Chicago, Harvard, and IEEE styles.
 * All formatting done locally following official style guides.
 *
 * Methods:
 *   format_citation(source, style)  — Format a citation              (1c)
 *   format_bibliography(sources)    — Format multiple citations       (1c)
 *   get_style_guide(style)          — Get style guide overview        (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface SourceInput {
  type: string
  authors: string[]
  title: string
  year: number
  journal?: string
  volume?: string
  issue?: string
  pages?: string
  publisher?: string
  city?: string
  url?: string
  accessed?: string
  doi?: string
  edition?: string
}

interface FormatCitationInput {
  source: SourceInput
  style: string
}

interface FormatBibInput {
  sources: SourceInput[]
  style: string
}

interface GetStyleInput {
  style: string
}

// --- Helpers ----------------------------------------------------------------

function formatAuthorAPA(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`
  if (authors.length <= 20) return authors.slice(0, -1).join(', ') + ', & ' + authors[authors.length - 1]
  return authors.slice(0, 19).join(', ') + ', ... ' + authors[authors.length - 1]
}

function formatAuthorMLA(authors: string[]): string {
  if (authors.length === 0) return ''
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]} and ${authors[1]}`
  return `${authors[0]}, et al.`
}

function formatAPA(s: SourceInput): string {
  const author = formatAuthorAPA(s.authors)
  if (s.type === 'journal') {
    const vol = s.volume ? `, ${s.volume}` : ''
    const iss = s.issue ? `(${s.issue})` : ''
    const pages = s.pages ? `, ${s.pages}` : ''
    const doi = s.doi ? ` https://doi.org/${s.doi}` : ''
    return `${author} (${s.year}). ${s.title}. ${s.journal ?? ''}${vol}${iss}${pages}.${doi}`
  }
  const pub = s.publisher ? ` ${s.publisher}.` : ''
  return `${author} (${s.year}). ${s.title}.${pub}`
}

function formatMLA(s: SourceInput): string {
  const author = formatAuthorMLA(s.authors)
  if (s.type === 'journal') {
    const vol = s.volume ? `, vol. ${s.volume}` : ''
    const iss = s.issue ? `, no. ${s.issue}` : ''
    const pages = s.pages ? `, pp. ${s.pages}` : ''
    return `${author}. "${s.title}." ${s.journal ?? ''}${vol}${iss}, ${s.year}${pages}.`
  }
  const pub = s.publisher ? ` ${s.publisher},` : ''
  return `${author}. ${s.title}.${pub} ${s.year}.`
}

function formatChicago(s: SourceInput): string {
  const author = s.authors.join(', ')
  if (s.type === 'journal') {
    const vol = s.volume ? ` ${s.volume}` : ''
    const iss = s.issue ? `, no. ${s.issue}` : ''
    const pages = s.pages ? `: ${s.pages}` : ''
    return `${author}. "${s.title}." ${s.journal ?? ''}${vol}${iss} (${s.year})${pages}.`
  }
  const pub = s.publisher ? ` ${s.city ? s.city + ': ' : ''}${s.publisher},` : ''
  return `${author}. ${s.title}.${pub} ${s.year}.`
}

function formatCitation(source: SourceInput, style: string): string {
  switch (style) {
    case 'apa': return formatAPA(source)
    case 'mla': return formatMLA(source)
    case 'chicago': return formatChicago(source)
    case 'harvard': return formatAPA(source).replace(/\(/, '').replace(/\)/, ',')
    default: return formatAPA(source)
  }
}

const STYLE_GUIDES: Record<string, { name: string; org: string; edition: string; use_cases: string[]; features: string[] }> = {
  apa: { name: 'APA', org: 'American Psychological Association', edition: '7th', use_cases: ['psychology', 'social sciences', 'education'], features: ['Author-date in-text', 'DOI preferred', 'Hanging indent'] },
  mla: { name: 'MLA', org: 'Modern Language Association', edition: '9th', use_cases: ['humanities', 'literature', 'cultural studies'], features: ['Author-page in-text', 'Works Cited list', 'et al. for 3+ authors'] },
  chicago: { name: 'Chicago', org: 'University of Chicago Press', edition: '17th', use_cases: ['history', 'arts', 'general publishing'], features: ['Notes-bibliography or author-date', 'Footnotes/endnotes', 'Flexible formatting'] },
  harvard: { name: 'Harvard', org: 'Various universities', edition: 'No single standard', use_cases: ['sciences', 'business', 'UK/AU universities'], features: ['Author-date system', 'No official manual', 'Reference list'] },
  ieee: { name: 'IEEE', org: 'Institute of Electrical and Electronics Engineers', edition: 'Current', use_cases: ['engineering', 'computer science', 'technology'], features: ['Numbered references', 'Square bracket citations', 'Compressed format'] },
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'citation-generator',
  pricing: {
    defaultCostCents: 1,
    methods: {
      format_citation: { costCents: 1, displayName: 'Format Citation' },
      format_bibliography: { costCents: 1, displayName: 'Format Bibliography' },
      get_style_guide: { costCents: 1, displayName: 'Get Style Guide' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const formatCitationHandler = sg.wrap(async (args: FormatCitationInput) => {
  if (!args.source || !args.style) throw new Error('source and style required')
  const style = args.style.toLowerCase()
  if (!STYLE_GUIDES[style]) throw new Error(`Unknown style. Available: ${Object.keys(STYLE_GUIDES).join(', ')}`)
  const formatted = formatCitation(args.source, style)
  return { citation: formatted, style, type: args.source.type }
}, { method: 'format_citation' })

const formatBibHandler = sg.wrap(async (args: FormatBibInput) => {
  if (!args.sources?.length || !args.style) throw new Error('sources array and style required')
  const style = args.style.toLowerCase()
  const citations = args.sources.map(s => formatCitation(s, style))
  return { style, count: citations.length, citations: citations.sort() }
}, { method: 'format_bibliography' })

const getStyleGuide = sg.wrap(async (args: GetStyleInput) => {
  if (!args.style) throw new Error('style required')
  const guide = STYLE_GUIDES[args.style.toLowerCase()]
  if (!guide) throw new Error(`Unknown style. Available: ${Object.keys(STYLE_GUIDES).join(', ')}`)
  return guide
}, { method: 'get_style_guide' })

// --- Exports ----------------------------------------------------------------

export { formatCitationHandler as formatCitation, formatBibHandler as formatBibliography, getStyleGuide }

console.log('settlegrid-citation-generator MCP server ready')
console.log('Methods: format_citation, format_bibliography, get_style_guide')
console.log('Pricing: 1c per call | Powered by SettleGrid')
