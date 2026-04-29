/**
 * settlegrid-lorem-generator — Lorem Ipsum Generator MCP Server
 *
 * Generates placeholder text in multiple styles (lorem ipsum, hipster,
 * business, tech). Supports paragraphs, sentences, and word counts.
 *
 * Methods:
 *   generate(type?, count?, unit?)  — Generate placeholder text      (1c)
 *   list_styles()                   — List available text styles     (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GenerateInput { type?: string; count?: number; unit?: string }

const LOREM_WORDS = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor incididunt ut labore et dolore magna aliqua ut enim ad minim veniam quis nostrud exercitation ullamco laboris nisi aliquip ex ea commodo consequat duis aute irure dolor in reprehenderit voluptate velit esse cillum dolore eu fugiat nulla pariatur excepteur sint occaecat cupidatat non proident sunt in culpa qui officia deserunt mollit anim id est laborum'.split(' ')
const HIPSTER_WORDS = 'artisan craft sustainable organic vegan gluten-free pour-over cold-brew single-origin ethically-sourced avocado kombucha sourdough typewriter vinyl aesthetic minimalist curated bespoke handcrafted small-batch farm-to-table locally-sourced plant-based mindful intentional slow-living hygge wabi-sabi kinfolk'.split(' ')
const BUSINESS_WORDS = 'synergy leverage paradigm stakeholder deliverable milestone scalable proactive benchmark optimize pipeline iterate agile streamline ecosystem innovation disruptive strategy alignment actionable framework metrics KPI ROI bandwidth vertical integration holistic cross-functional'.split(' ')
const TECH_WORDS = 'API microservice container kubernetes docker serverless cloud-native CI/CD pipeline deployment orchestration scalability latency throughput observability DevOps infrastructure-as-code terraform ansible webhook endpoint middleware cache distributed system blockchain edge-computing machine-learning neural-network'.split(' ')

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function generateWords(words: string[], count: number): string {
  return Array.from({ length: count }, () => pick(words)).join(' ')
}

function generateSentence(words: string[]): string {
  const len = Math.floor(Math.random() * 10) + 5
  const sentence = generateWords(words, len)
  return sentence.charAt(0).toUpperCase() + sentence.slice(1) + '.'
}

function generateParagraph(words: string[]): string {
  const sentenceCount = Math.floor(Math.random() * 4) + 3
  return Array.from({ length: sentenceCount }, () => generateSentence(words)).join(' ')
}

const STYLES: Record<string, { words: string[]; description: string }> = {
  lorem: { words: LOREM_WORDS, description: 'Classic Latin placeholder text' },
  hipster: { words: HIPSTER_WORDS, description: 'Artisan hipster-style text' },
  business: { words: BUSINESS_WORDS, description: 'Corporate jargon text' },
  tech: { words: TECH_WORDS, description: 'Technical/DevOps terminology' },
}

const sg = settlegrid.init({
  toolSlug: 'lorem-generator',
  pricing: { defaultCostCents: 1, methods: {
    generate: { costCents: 1, displayName: 'Generate Text' },
    list_styles: { costCents: 1, displayName: 'List Styles' },
  }},
})

const generate = sg.wrap(async (args: GenerateInput) => {
  const style = STYLES[(args.type ?? 'lorem').toLowerCase()]
  if (!style) throw new Error(`Unknown style. Available: ${Object.keys(STYLES).join(', ')}`)
  const count = Math.min(Math.max(args.count ?? 3, 1), 20)
  const unit = (args.unit ?? 'paragraphs').toLowerCase()
  let text: string
  if (unit === 'words') text = generateWords(style.words, count)
  else if (unit === 'sentences') text = Array.from({ length: count }, () => generateSentence(style.words)).join(' ')
  else text = Array.from({ length: count }, () => generateParagraph(style.words)).join('\n\n')
  const wordCount = text.split(/\s+/).length
  return { text, style: args.type ?? 'lorem', unit, count, word_count: wordCount, char_count: text.length }
}, { method: 'generate' })

const listStyles = sg.wrap(async (_a: Record<string, never>) => {
  return { styles: Object.entries(STYLES).map(([name, s]) => ({ name, description: s.description, sample_words: s.words.slice(0, 5) })), units: ['paragraphs', 'sentences', 'words'] }
}, { method: 'list_styles' })

export { generate, listStyles }
console.log('settlegrid-lorem-generator MCP server ready')
console.log('Pricing: 1c per call | Powered by SettleGrid')
