/**
 * Batch generator: 15 Education + 15 Business/Commerce MCP servers (256-285)
 *
 * Run:  cd /Users/lex/settlegrid && node scripts/batch-education-business.mjs
 */

import { generateServer } from './lib/generate.mjs'

console.log('\n=== Education Servers (256-270) ===\n')

// ─── 256. settlegrid-gutenberg ────────────────────────────────────────────────

generateServer({
  slug: 'gutenberg',
  name: 'Project Gutenberg',
  description: 'Search and retrieve free ebooks from Project Gutenberg via the Gutendex API.',
  keywords: ['education', 'books', 'ebooks', 'literature', 'gutenberg'],
  upstream: { provider: 'Gutendex', baseUrl: 'https://gutendex.com', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://gutendex.com' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_books', displayName: 'Search Books', costCents: 1, description: 'Search free ebooks by title, author, or topic', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (title, author, topic)' }] },
    { name: 'get_book', displayName: 'Get Book Details', costCents: 1, description: 'Get full details for a specific book by ID', params: [{ name: 'id', type: 'number', required: true, description: 'Gutenberg book ID' }] },
    { name: 'get_popular', displayName: 'Popular Books', costCents: 1, description: 'Get most popular/downloaded free ebooks', params: [{ name: 'topic', type: 'string', required: false, description: 'Optional topic filter (e.g. "science", "fiction")' }] },
  ],
  serverTs: `/**
 * settlegrid-gutenberg — Project Gutenberg Free Ebooks MCP Server
 *
 * Wraps the free Gutendex API with SettleGrid billing.
 * No API key needed for the upstream service.
 *
 * Methods:
 *   search_books(query)     — Search free ebooks             (1¢)
 *   get_book(id)            — Get book details by ID         (1¢)
 *   get_popular(topic?)     — Get popular/downloaded ebooks  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface GetBookInput { id: number }
interface PopularInput { topic?: string }

interface GutenbergBook {
  id: number
  title: string
  authors: Array<{ name: string; birth_year: number | null; death_year: number | null }>
  subjects: string[]
  bookshelves: string[]
  languages: string[]
  download_count: number
  formats: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://gutendex.com'

async function gutenbergFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Gutendex API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatBook(b: GutenbergBook) {
  return {
    id: b.id,
    title: b.title,
    authors: b.authors.map(a => a.name),
    subjects: b.subjects.slice(0, 5),
    languages: b.languages,
    downloadCount: b.download_count,
    readOnline: b.formats['text/html'] || null,
    plainText: b.formats['text/plain; charset=utf-8'] || b.formats['text/plain'] || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'gutenberg',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_books: { costCents: 1, displayName: 'Search Books' },
      get_book: { costCents: 1, displayName: 'Get Book Details' },
      get_popular: { costCents: 1, displayName: 'Popular Books' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBooks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const q = encodeURIComponent(args.query.trim())
  const data = await gutenbergFetch<{ count: number; results: GutenbergBook[] }>(\`/books?search=\${q}\`)
  return { query: args.query, count: data.count, books: data.results.slice(0, 15).map(formatBook) }
}, { method: 'search_books' })

const getBook = sg.wrap(async (args: GetBookInput) => {
  if (typeof args.id !== 'number' || args.id < 1) {
    throw new Error('id must be a positive number')
  }
  const book = await gutenbergFetch<GutenbergBook>(\`/books/\${args.id}\`)
  return formatBook(book)
}, { method: 'get_book' })

const getPopular = sg.wrap(async (args: PopularInput) => {
  const topicParam = args.topic ? \`&topic=\${encodeURIComponent(args.topic)}\` : ''
  const data = await gutenbergFetch<{ count: number; results: GutenbergBook[] }>(\`/books?sort=popular\${topicParam}\`)
  return { topic: args.topic || 'all', count: data.count, books: data.results.slice(0, 15).map(formatBook) }
}, { method: 'get_popular' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBooks, getBook, getPopular }

console.log('settlegrid-gutenberg MCP server ready')
console.log('Methods: search_books, get_book, get_popular')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 257. settlegrid-google-books ─────────────────────────────────────────────

generateServer({
  slug: 'google-books',
  name: 'Google Books',
  description: 'Search books, get volume details, and browse bookshelves via the Google Books API.',
  keywords: ['education', 'books', 'google', 'isbn', 'library'],
  upstream: { provider: 'Google', baseUrl: 'https://www.googleapis.com/books/v1', auth: 'Free API key (optional for basic use)', rateLimit: '1000 requests/day free', docsUrl: 'https://developers.google.com/books/docs/v1/reference' },
  auth: { type: 'query', keyEnvVar: 'GOOGLE_BOOKS_API_KEY', keyDesc: 'Google Books API key (optional, increases quota)' },
  methods: [
    { name: 'search_volumes', displayName: 'Search Volumes', costCents: 1, description: 'Search books by title, author, ISBN, or keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (title, author, ISBN)' }, { name: 'maxResults', type: 'number', required: false, description: 'Max results 1-40 (default 10)' }] },
    { name: 'get_volume', displayName: 'Get Volume', costCents: 1, description: 'Get detailed info for a specific volume by ID', params: [{ name: 'volumeId', type: 'string', required: true, description: 'Google Books volume ID' }] },
  ],
  serverTs: `/**
 * settlegrid-google-books — Google Books MCP Server
 *
 * Wraps the Google Books API with SettleGrid billing.
 * API key optional but recommended for higher quota.
 *
 * Methods:
 *   search_volumes(query, maxResults?)  — Search books   (1¢)
 *   get_volume(volumeId)               — Volume details  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; maxResults?: number }
interface GetVolumeInput { volumeId: string }

interface VolumeInfo {
  title: string
  authors?: string[]
  publisher?: string
  publishedDate?: string
  description?: string
  pageCount?: number
  categories?: string[]
  averageRating?: number
  ratingsCount?: number
  imageLinks?: { thumbnail?: string }
  industryIdentifiers?: Array<{ type: string; identifier: string }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://www.googleapis.com/books/v1'
const API_KEY = process.env.GOOGLE_BOOKS_API_KEY || ''

async function booksFetch<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?'
  const keyParam = API_KEY ? \`\${separator}key=\${API_KEY}\` : ''
  const res = await fetch(\`\${API_BASE}\${path}\${keyParam}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Google Books API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatVolume(v: { id: string; volumeInfo: VolumeInfo }) {
  const info = v.volumeInfo
  return {
    id: v.id,
    title: info.title,
    authors: info.authors || [],
    publisher: info.publisher || null,
    publishedDate: info.publishedDate || null,
    description: info.description?.slice(0, 500) || null,
    pageCount: info.pageCount || null,
    categories: info.categories || [],
    rating: info.averageRating || null,
    ratingsCount: info.ratingsCount || 0,
    thumbnail: info.imageLinks?.thumbnail || null,
    isbn: info.industryIdentifiers?.find(i => i.type === 'ISBN_13')?.identifier || info.industryIdentifiers?.[0]?.identifier || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'google-books',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_volumes: { costCents: 1, displayName: 'Search Volumes' },
      get_volume: { costCents: 1, displayName: 'Get Volume' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchVolumes = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') {
    throw new Error('query is required')
  }
  const max = Math.min(Math.max(args.maxResults || 10, 1), 40)
  const q = encodeURIComponent(args.query.trim())
  const data = await booksFetch<{ totalItems: number; items?: Array<{ id: string; volumeInfo: VolumeInfo }> }>(\`/volumes?q=\${q}&maxResults=\${max}\`)
  return { query: args.query, totalItems: data.totalItems, volumes: (data.items || []).map(formatVolume) }
}, { method: 'search_volumes' })

const getVolume = sg.wrap(async (args: GetVolumeInput) => {
  if (!args.volumeId || typeof args.volumeId !== 'string') {
    throw new Error('volumeId is required')
  }
  const data = await booksFetch<{ id: string; volumeInfo: VolumeInfo }>(\`/volumes/\${encodeURIComponent(args.volumeId)}\`)
  return formatVolume(data)
}, { method: 'get_volume' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchVolumes, getVolume }

console.log('settlegrid-google-books MCP server ready')
console.log('Methods: search_volumes, get_volume')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 258. settlegrid-dictionary ───────────────────────────────────────────────

generateServer({
  slug: 'dictionary',
  name: 'Free Dictionary',
  description: 'Look up word definitions, phonetics, and usage examples via the Free Dictionary API.',
  keywords: ['education', 'dictionary', 'definitions', 'language', 'words'],
  upstream: { provider: 'Free Dictionary API', baseUrl: 'https://api.dictionaryapi.dev/api/v2', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://dictionaryapi.dev/' },
  auth: { type: 'none' },
  methods: [
    { name: 'define', displayName: 'Define Word', costCents: 1, description: 'Get definitions, phonetics, and examples for a word', params: [{ name: 'word', type: 'string', required: true, description: 'Word to define' }] },
    { name: 'define_language', displayName: 'Define in Language', costCents: 1, description: 'Get definitions in a specific language (en, es, fr, de, etc.)', params: [{ name: 'word', type: 'string', required: true, description: 'Word to define' }, { name: 'language', type: 'string', required: true, description: 'Language code (en, es, fr, de, it, pt, etc.)' }] },
  ],
  serverTs: `/**
 * settlegrid-dictionary — Free Dictionary MCP Server
 *
 * Wraps the Free Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define(word)                       — Word definitions        (1¢)
 *   define_language(word, language)    — Definitions in language  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DefineInput { word: string }
interface DefineLanguageInput { word: string; language: string }

interface DictionaryEntry {
  word: string
  phonetic?: string
  phonetics: Array<{ text?: string; audio?: string }>
  meanings: Array<{
    partOfSpeech: string
    definitions: Array<{ definition: string; example?: string; synonyms: string[]; antonyms: string[] }>
  }>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries'
const VALID_LANGS = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'ar', 'cs', 'da', 'el', 'fi', 'hi', 'hu', 'id', 'ja', 'ko', 'nl', 'no', 'pl', 'ro', 'ru', 'sk', 'sv', 'th', 'tr', 'uk', 'zh'])
const WORD_RE = /^[a-zA-Z\\u00C0-\\u024F\\u1E00-\\u1EFF'-]{1,50}$/

async function dictFetch(lang: string, word: string): Promise<DictionaryEntry[]> {
  const res = await fetch(\`\${API_BASE}/\${lang}/\${encodeURIComponent(word)}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error(\`Word "\${word}" not found in \${lang} dictionary\`)
    const body = await res.text().catch(() => '')
    throw new Error(\`Dictionary API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<DictionaryEntry[]>
}

function formatEntry(entries: DictionaryEntry[]) {
  return entries.map(e => ({
    word: e.word,
    phonetic: e.phonetic || e.phonetics.find(p => p.text)?.text || null,
    audio: e.phonetics.find(p => p.audio)?.audio || null,
    meanings: e.meanings.map(m => ({
      partOfSpeech: m.partOfSpeech,
      definitions: m.definitions.slice(0, 5).map(d => ({
        definition: d.definition,
        example: d.example || null,
        synonyms: d.synonyms.slice(0, 5),
        antonyms: d.antonyms.slice(0, 5),
      })),
    })),
  }))
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define: { costCents: 1, displayName: 'Define Word' },
      define_language: { costCents: 1, displayName: 'Define in Language' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const define = sg.wrap(async (args: DefineInput) => {
  if (!args.word || typeof args.word !== 'string') throw new Error('word is required')
  const word = args.word.trim().toLowerCase()
  if (!WORD_RE.test(word)) throw new Error('Invalid word format')
  const entries = await dictFetch('en', word)
  return { word, entries: formatEntry(entries) }
}, { method: 'define' })

const defineLanguage = sg.wrap(async (args: DefineLanguageInput) => {
  if (!args.word || typeof args.word !== 'string') throw new Error('word is required')
  if (!args.language || !VALID_LANGS.has(args.language.toLowerCase())) {
    throw new Error(\`language must be one of: \${[...VALID_LANGS].sort().join(', ')}\`)
  }
  const word = args.word.trim().toLowerCase()
  const lang = args.language.toLowerCase()
  const entries = await dictFetch(lang, word)
  return { word, language: lang, entries: formatEntry(entries) }
}, { method: 'define_language' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { define, defineLanguage }

console.log('settlegrid-dictionary MCP server ready')
console.log('Methods: define, define_language')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 259. settlegrid-thesaurus ────────────────────────────────────────────────

generateServer({
  slug: 'thesaurus',
  name: 'Thesaurus',
  description: 'Find synonyms, antonyms, and related words via the Datamuse API.',
  keywords: ['education', 'thesaurus', 'synonyms', 'antonyms', 'words'],
  upstream: { provider: 'Datamuse', baseUrl: 'https://api.datamuse.com', auth: 'None required', rateLimit: '100,000 requests/day', docsUrl: 'https://www.datamuse.com/api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_synonyms', displayName: 'Get Synonyms', costCents: 1, description: 'Find synonyms for a word', params: [{ name: 'word', type: 'string', required: true, description: 'Word to find synonyms for' }] },
    { name: 'get_antonyms', displayName: 'Get Antonyms', costCents: 1, description: 'Find antonyms for a word', params: [{ name: 'word', type: 'string', required: true, description: 'Word to find antonyms for' }] },
    { name: 'get_related', displayName: 'Get Related Words', costCents: 1, description: 'Find words related to a concept', params: [{ name: 'word', type: 'string', required: true, description: 'Word or concept' }, { name: 'relation', type: 'string', required: false, description: 'Relation type: syn, ant, trg (triggers), jja (adjectives), jjb (described by), rhy (rhymes)' }] },
  ],
  serverTs: `/**
 * settlegrid-thesaurus — Thesaurus MCP Server
 *
 * Wraps the Datamuse API for synonyms/antonyms with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_synonyms(word)             — Find synonyms       (1¢)
 *   get_antonyms(word)             — Find antonyms       (1¢)
 *   get_related(word, relation?)   — Related words        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SynonymInput { word: string }
interface AntonymInput { word: string }
interface RelatedInput { word: string; relation?: string }

interface DatamuseWord { word: string; score: number; tags?: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datamuse.com'
const VALID_RELATIONS = new Set(['syn', 'ant', 'trg', 'jja', 'jjb', 'rhy', 'nry', 'hom', 'cns'])

async function damuseFetch(path: string): Promise<DatamuseWord[]> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Datamuse API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<DatamuseWord[]>
}

function validateWord(word: string): string {
  if (!word || typeof word !== 'string') throw new Error('word is required')
  const trimmed = word.trim().toLowerCase()
  if (trimmed.length === 0 || trimmed.length > 50) throw new Error('word must be 1-50 characters')
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'thesaurus',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_synonyms: { costCents: 1, displayName: 'Get Synonyms' },
      get_antonyms: { costCents: 1, displayName: 'Get Antonyms' },
      get_related: { costCents: 1, displayName: 'Get Related Words' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getSynonyms = sg.wrap(async (args: SynonymInput) => {
  const word = validateWord(args.word)
  const results = await damuseFetch(\`/words?rel_syn=\${encodeURIComponent(word)}&max=25\`)
  return { word, count: results.length, synonyms: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_synonyms' })

const getAntonyms = sg.wrap(async (args: AntonymInput) => {
  const word = validateWord(args.word)
  const results = await damuseFetch(\`/words?rel_ant=\${encodeURIComponent(word)}&max=25\`)
  return { word, count: results.length, antonyms: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_antonyms' })

const getRelated = sg.wrap(async (args: RelatedInput) => {
  const word = validateWord(args.word)
  const rel = args.relation || 'trg'
  if (!VALID_RELATIONS.has(rel)) {
    throw new Error(\`relation must be one of: \${[...VALID_RELATIONS].join(', ')}\`)
  }
  const results = await damuseFetch(\`/words?rel_\${rel}=\${encodeURIComponent(word)}&max=25\`)
  return { word, relation: rel, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'get_related' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getSynonyms, getAntonyms, getRelated }

console.log('settlegrid-thesaurus MCP server ready')
console.log('Methods: get_synonyms, get_antonyms, get_related')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 260. settlegrid-urban-dictionary ─────────────────────────────────────────

generateServer({
  slug: 'urban-dictionary',
  name: 'Urban Dictionary',
  description: 'Look up slang definitions and trending words via the Urban Dictionary API.',
  keywords: ['education', 'slang', 'definitions', 'urban', 'language'],
  upstream: { provider: 'Urban Dictionary', baseUrl: 'https://api.urbandictionary.com/v0', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://api.urbandictionary.com' },
  auth: { type: 'none' },
  methods: [
    { name: 'define', displayName: 'Define Slang', costCents: 1, description: 'Look up a slang term on Urban Dictionary', params: [{ name: 'term', type: 'string', required: true, description: 'Slang term to look up' }] },
    { name: 'random', displayName: 'Random Definitions', costCents: 1, description: 'Get random slang definitions', params: [] },
  ],
  serverTs: `/**
 * settlegrid-urban-dictionary — Urban Dictionary MCP Server
 *
 * Wraps the Urban Dictionary API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   define(term)    — Look up slang definition  (1¢)
 *   random()        — Random definitions        (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DefineInput { term: string }

interface UrbanEntry {
  definition: string
  permalink: string
  thumbs_up: number
  thumbs_down: number
  author: string
  word: string
  written_on: string
  example: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.urbandictionary.com/v0'

async function urbanFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Urban Dictionary API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatEntry(e: UrbanEntry) {
  return {
    word: e.word,
    definition: e.definition.replace(/\\[|\\]/g, '').slice(0, 500),
    example: e.example.replace(/\\[|\\]/g, '').slice(0, 300),
    author: e.author,
    thumbsUp: e.thumbs_up,
    thumbsDown: e.thumbs_down,
    permalink: e.permalink,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'urban-dictionary',
  pricing: {
    defaultCostCents: 1,
    methods: {
      define: { costCents: 1, displayName: 'Define Slang' },
      random: { costCents: 1, displayName: 'Random Definitions' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const define = sg.wrap(async (args: DefineInput) => {
  if (!args.term || typeof args.term !== 'string') throw new Error('term is required')
  const term = args.term.trim()
  if (term.length === 0 || term.length > 100) throw new Error('term must be 1-100 characters')
  const data = await urbanFetch<{ list: UrbanEntry[] }>(\`/define?term=\${encodeURIComponent(term)}\`)
  const sorted = data.list.sort((a, b) => b.thumbs_up - a.thumbs_up)
  return { term, count: sorted.length, definitions: sorted.slice(0, 10).map(formatEntry) }
}, { method: 'define' })

const random = sg.wrap(async () => {
  const data = await urbanFetch<{ list: UrbanEntry[] }>('/random')
  return { definitions: data.list.slice(0, 10).map(formatEntry) }
}, { method: 'random' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { define, random }

console.log('settlegrid-urban-dictionary MCP server ready')
console.log('Methods: define, random')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 261. settlegrid-datamuse ─────────────────────────────────────────────────

generateServer({
  slug: 'datamuse',
  name: 'Datamuse Word API',
  description: 'Find word associations, completions, and rhymes via the Datamuse API.',
  keywords: ['education', 'words', 'associations', 'rhymes', 'language'],
  upstream: { provider: 'Datamuse', baseUrl: 'https://api.datamuse.com', auth: 'None required', rateLimit: '100,000 requests/day', docsUrl: 'https://www.datamuse.com/api/' },
  auth: { type: 'none' },
  methods: [
    { name: 'means_like', displayName: 'Means Like', costCents: 1, description: 'Find words with a similar meaning', params: [{ name: 'query', type: 'string', required: true, description: 'Concept or phrase to match' }] },
    { name: 'sounds_like', displayName: 'Sounds Like', costCents: 1, description: 'Find words that sound like the input', params: [{ name: 'word', type: 'string', required: true, description: 'Word to match phonetically' }] },
    { name: 'spelled_like', displayName: 'Spelled Like', costCents: 1, description: 'Find words spelled similarly (supports wildcards)', params: [{ name: 'pattern', type: 'string', required: true, description: 'Spelling pattern (use ? for single char, * for multiple)' }] },
  ],
  serverTs: `/**
 * settlegrid-datamuse — Datamuse Word API MCP Server
 *
 * Wraps the Datamuse API for word associations with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   means_like(query)      — Words with similar meaning  (1¢)
 *   sounds_like(word)      — Phonetically similar words  (1¢)
 *   spelled_like(pattern)  — Spelling pattern match       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface MeansLikeInput { query: string }
interface SoundsLikeInput { word: string }
interface SpelledLikeInput { pattern: string }

interface DatamuseResult { word: string; score: number; tags?: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.datamuse.com'

async function damuseFetch(path: string): Promise<DatamuseResult[]> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Datamuse API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<DatamuseResult[]>
}

function validateInput(val: string, name: string): string {
  if (!val || typeof val !== 'string') throw new Error(\`\${name} is required\`)
  const trimmed = val.trim()
  if (trimmed.length === 0 || trimmed.length > 100) throw new Error(\`\${name} must be 1-100 characters\`)
  return trimmed
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'datamuse',
  pricing: {
    defaultCostCents: 1,
    methods: {
      means_like: { costCents: 1, displayName: 'Means Like' },
      sounds_like: { costCents: 1, displayName: 'Sounds Like' },
      spelled_like: { costCents: 1, displayName: 'Spelled Like' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const meansLike = sg.wrap(async (args: MeansLikeInput) => {
  const query = validateInput(args.query, 'query')
  const results = await damuseFetch(\`/words?ml=\${encodeURIComponent(query)}&max=25\`)
  return { query, count: results.length, words: results.map(r => ({ word: r.word, score: r.score, tags: r.tags || [] })) }
}, { method: 'means_like' })

const soundsLike = sg.wrap(async (args: SoundsLikeInput) => {
  const word = validateInput(args.word, 'word')
  const results = await damuseFetch(\`/words?sl=\${encodeURIComponent(word)}&max=25\`)
  return { word, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'sounds_like' })

const spelledLike = sg.wrap(async (args: SpelledLikeInput) => {
  const pattern = validateInput(args.pattern, 'pattern')
  const results = await damuseFetch(\`/words?sp=\${encodeURIComponent(pattern)}&max=25\`)
  return { pattern, count: results.length, words: results.map(r => ({ word: r.word, score: r.score })) }
}, { method: 'spelled_like' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { meansLike, soundsLike, spelledLike }

console.log('settlegrid-datamuse MCP server ready')
console.log('Methods: means_like, sounds_like, spelled_like')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 262. settlegrid-math-js ──────────────────────────────────────────────────

generateServer({
  slug: 'math-js',
  name: 'Math.js',
  description: 'Evaluate mathematical expressions, perform unit conversions, and compute formulas via the Math.js API.',
  keywords: ['education', 'math', 'calculator', 'computation', 'formulas'],
  upstream: { provider: 'Math.js', baseUrl: 'https://api.mathjs.org/v4', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://api.mathjs.org/' },
  auth: { type: 'none' },
  methods: [
    { name: 'evaluate', displayName: 'Evaluate Expression', costCents: 1, description: 'Evaluate a mathematical expression', params: [{ name: 'expression', type: 'string', required: true, description: 'Math expression (e.g. "2 * (3 + 4)", "sqrt(16)", "5 cm to inch")' }] },
    { name: 'evaluate_batch', displayName: 'Evaluate Batch', costCents: 2, description: 'Evaluate multiple expressions at once', params: [{ name: 'expressions', type: 'string[]', required: true, description: 'Array of math expressions' }] },
  ],
  serverTs: `/**
 * settlegrid-math-js — Math.js Computation MCP Server
 *
 * Wraps the Math.js API for expression evaluation with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   evaluate(expression)           — Evaluate math expression  (1¢)
 *   evaluate_batch(expressions)    — Evaluate multiple exprs   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface EvaluateInput { expression: string }
interface BatchInput { expressions: string[] }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.mathjs.org/v4'
const MAX_EXPR_LENGTH = 500
const MAX_BATCH_SIZE = 20

async function mathFetch(body: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(API_BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(\`Math.js API \${res.status}: \${text.slice(0, 200)}\`)
  }
  return res.json()
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'math-js',
  pricing: {
    defaultCostCents: 1,
    methods: {
      evaluate: { costCents: 1, displayName: 'Evaluate Expression' },
      evaluate_batch: { costCents: 2, displayName: 'Evaluate Batch' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const evaluate = sg.wrap(async (args: EvaluateInput) => {
  if (!args.expression || typeof args.expression !== 'string') {
    throw new Error('expression is required')
  }
  const expr = args.expression.trim()
  if (expr.length === 0 || expr.length > MAX_EXPR_LENGTH) {
    throw new Error(\`expression must be 1-\${MAX_EXPR_LENGTH} characters\`)
  }
  const data = await mathFetch({ expr }) as { result: string; error?: string }
  if (data.error) throw new Error(\`Math error: \${data.error}\`)
  return { expression: expr, result: data.result }
}, { method: 'evaluate' })

const evaluateBatch = sg.wrap(async (args: BatchInput) => {
  if (!Array.isArray(args.expressions) || args.expressions.length === 0) {
    throw new Error('expressions must be a non-empty array')
  }
  if (args.expressions.length > MAX_BATCH_SIZE) {
    throw new Error(\`Maximum \${MAX_BATCH_SIZE} expressions per batch\`)
  }
  for (const expr of args.expressions) {
    if (typeof expr !== 'string' || expr.trim().length === 0 || expr.length > MAX_EXPR_LENGTH) {
      throw new Error(\`Each expression must be a non-empty string up to \${MAX_EXPR_LENGTH} chars\`)
    }
  }
  const data = await mathFetch({ expr: args.expressions }) as { result: string[]; error?: string }
  if (data.error) throw new Error(\`Math error: \${data.error}\`)
  return {
    count: args.expressions.length,
    results: args.expressions.map((expr, i) => ({ expression: expr, result: data.result[i] })),
  }
}, { method: 'evaluate_batch' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { evaluate, evaluateBatch }

console.log('settlegrid-math-js MCP server ready')
console.log('Methods: evaluate, evaluate_batch')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─── 263. settlegrid-numbers-api ──────────────────────────────────────────────

generateServer({
  slug: 'numbers-api',
  name: 'Numbers API',
  description: 'Get interesting facts about numbers, dates, and math trivia via the Numbers API.',
  keywords: ['education', 'numbers', 'trivia', 'math', 'facts'],
  upstream: { provider: 'Numbers API', baseUrl: 'http://numbersapi.com', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'http://numbersapi.com' },
  auth: { type: 'none' },
  methods: [
    { name: 'number_fact', displayName: 'Number Fact', costCents: 1, description: 'Get a trivia fact about a number', params: [{ name: 'number', type: 'number', required: true, description: 'The number to get a fact about' }] },
    { name: 'date_fact', displayName: 'Date Fact', costCents: 1, description: 'Get a fact about a date in history', params: [{ name: 'month', type: 'number', required: true, description: 'Month (1-12)' }, { name: 'day', type: 'number', required: true, description: 'Day of month (1-31)' }] },
    { name: 'math_fact', displayName: 'Math Fact', costCents: 1, description: 'Get a mathematical property of a number', params: [{ name: 'number', type: 'number', required: true, description: 'The number to get a math fact about' }] },
  ],
  serverTs: `/**
 * settlegrid-numbers-api — Numbers API Trivia MCP Server
 *
 * Wraps the Numbers API for number/date trivia with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   number_fact(number)        — Trivia about a number  (1¢)
 *   date_fact(month, day)      — Historical date fact   (1¢)
 *   math_fact(number)          — Math property fact     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface NumberInput { number: number }
interface DateInput { month: number; day: number }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://numbersapi.com'

async function numbersFetch(path: string): Promise<{ text: string; number: number; type: string; found: boolean }> {
  const res = await fetch(\`\${API_BASE}\${path}?json\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Numbers API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<{ text: string; number: number; type: string; found: boolean }>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'numbers-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      number_fact: { costCents: 1, displayName: 'Number Fact' },
      date_fact: { costCents: 1, displayName: 'Date Fact' },
      math_fact: { costCents: 1, displayName: 'Math Fact' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const numberFact = sg.wrap(async (args: NumberInput) => {
  if (typeof args.number !== 'number' || !Number.isFinite(args.number)) {
    throw new Error('number must be a finite number')
  }
  const n = Math.round(args.number)
  const data = await numbersFetch(\`/\${n}/trivia\`)
  return { number: n, type: 'trivia', fact: data.text, found: data.found }
}, { method: 'number_fact' })

const dateFact = sg.wrap(async (args: DateInput) => {
  if (typeof args.month !== 'number' || args.month < 1 || args.month > 12) {
    throw new Error('month must be 1-12')
  }
  if (typeof args.day !== 'number' || args.day < 1 || args.day > 31) {
    throw new Error('day must be 1-31')
  }
  const data = await numbersFetch(\`/\${Math.round(args.month)}/\${Math.round(args.day)}/date\`)
  return { month: args.month, day: args.day, type: 'date', fact: data.text, found: data.found }
}, { method: 'date_fact' })

const mathFact = sg.wrap(async (args: NumberInput) => {
  if (typeof args.number !== 'number' || !Number.isFinite(args.number)) {
    throw new Error('number must be a finite number')
  }
  const n = Math.round(args.number)
  const data = await numbersFetch(\`/\${n}/math\`)
  return { number: n, type: 'math', fact: data.text, found: data.found }
}, { method: 'math_fact' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { numberFact, dateFact, mathFact }

console.log('settlegrid-numbers-api MCP server ready')
console.log('Methods: number_fact, date_fact, math_fact')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 264. settlegrid-periodic-table ───────────────────────────────────────────

generateServer({
  slug: 'periodic-table',
  name: 'Periodic Table',
  description: 'Look up chemical element data including properties, atomic info, and classifications.',
  keywords: ['education', 'chemistry', 'elements', 'periodic-table', 'science'],
  upstream: { provider: 'Periodic Table API', baseUrl: 'https://neelpatel05.pythonanywhere.com', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://github.com/neelpatel05/periodic-table-api' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_element', displayName: 'Get Element', costCents: 1, description: 'Get detailed info about a chemical element', params: [{ name: 'query', type: 'string', required: true, description: 'Element name, symbol, or atomic number (e.g. "Hydrogen", "H", "1")' }] },
    { name: 'list_elements', displayName: 'List Elements', costCents: 1, description: 'List all elements or filter by group/category', params: [{ name: 'category', type: 'string', required: false, description: 'Filter by category (e.g. "noble gas", "alkali metal", "transition metal")' }] },
  ],
  serverTs: `/**
 * settlegrid-periodic-table — Periodic Table MCP Server
 *
 * Wraps a free Periodic Table API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_element(query)        — Element details by name/symbol/number  (1¢)
 *   list_elements(category?)  — List or filter elements                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetElementInput { query: string }
interface ListInput { category?: string }

interface Element {
  name: string
  symbol: string
  atomicNumber: number
  atomicMass: string
  groupBlock: string
  standardState: string
  electronicConfiguration: string
  yearDiscovered: string
  meltingPoint?: number
  boilingPoint?: number
  density?: number
  oxidationStates?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://neelpatel05.pythonanywhere.com'

async function periodicFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Element not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`Periodic Table API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatElement(e: Record<string, unknown>) {
  return {
    name: e.name as string,
    symbol: e.symbol as string,
    atomicNumber: e.atomicNumber as number,
    atomicMass: e.atomicMass as string,
    groupBlock: e.groupBlock as string,
    standardState: e.standardState as string || 'unknown',
    electronicConfiguration: e.electronicConfiguration as string,
    yearDiscovered: e.yearDiscovered as string,
    meltingPoint: (e.meltingPoint as number) || null,
    boilingPoint: (e.boilingPoint as number) || null,
    density: (e.density as number) || null,
    oxidationStates: (e.oxidationStates as string) || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'periodic-table',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_element: { costCents: 1, displayName: 'Get Element' },
      list_elements: { costCents: 1, displayName: 'List Elements' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getElement = sg.wrap(async (args: GetElementInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = args.query.trim()
  if (q.length === 0 || q.length > 30) throw new Error('query must be 1-30 characters')

  // Try atomic number first, then name
  const isNumber = /^\\d+$/.test(q)
  if (isNumber) {
    const num = parseInt(q, 10)
    if (num < 1 || num > 118) throw new Error('Atomic number must be 1-118')
    const data = await periodicFetch<Record<string, unknown>>(\`/atomicNumber/\${num}\`)
    return formatElement(data)
  }

  // Try as element name
  const capitalized = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
  const data = await periodicFetch<Record<string, unknown>>(\`/element/\${encodeURIComponent(capitalized)}\`)
  return formatElement(data)
}, { method: 'get_element' })

const listElements = sg.wrap(async (args: ListInput) => {
  const allData = await periodicFetch<Record<string, unknown>[]>('/')
  let elements = allData

  if (args.category && typeof args.category === 'string') {
    const cat = args.category.toLowerCase().trim()
    elements = allData.filter(e => {
      const group = ((e.groupBlock as string) || '').toLowerCase()
      return group.includes(cat)
    })
  }

  return {
    category: args.category || 'all',
    count: elements.length,
    elements: elements.map(e => ({
      name: e.name,
      symbol: e.symbol,
      atomicNumber: e.atomicNumber,
      groupBlock: e.groupBlock,
    })),
  }
}, { method: 'list_elements' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getElement, listElements }

console.log('settlegrid-periodic-table MCP server ready')
console.log('Methods: get_element, list_elements')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 265. settlegrid-country-flags ────────────────────────────────────────────

generateServer({
  slug: 'country-flags',
  name: 'Country Flags',
  description: 'Get country flag images, country info, and flag URLs via the REST Countries API.',
  keywords: ['education', 'flags', 'countries', 'geography', 'images'],
  upstream: { provider: 'REST Countries / FlagCDN', baseUrl: 'https://restcountries.com/v3.1', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://restcountries.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_flag', displayName: 'Get Flag', costCents: 1, description: 'Get flag image URL and country info by country code', params: [{ name: 'code', type: 'string', required: true, description: 'ISO 3166-1 alpha-2 country code (e.g. "US", "GB", "JP")' }] },
    { name: 'search_flags', displayName: 'Search Flags', costCents: 1, description: 'Search countries and their flags by name', params: [{ name: 'name', type: 'string', required: true, description: 'Country name to search' }] },
  ],
  serverTs: `/**
 * settlegrid-country-flags — Country Flags MCP Server
 *
 * Wraps REST Countries API for flag data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_flag(code)      — Flag URL + info by country code  (1¢)
 *   search_flags(name)  — Search countries by name          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetFlagInput { code: string }
interface SearchInput { name: string }

interface CountryData {
  name: { common: string; official: string }
  cca2: string
  cca3: string
  flags: { png: string; svg: string; alt?: string }
  capital?: string[]
  region: string
  subregion?: string
  population: number
  languages?: Record<string, string>
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const FIELDS = 'name,cca2,cca3,flags,capital,region,subregion,population,languages'

async function countriesFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Country not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`REST Countries API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatCountry(c: CountryData) {
  return {
    name: c.name.common,
    officialName: c.name.official,
    code: c.cca2,
    code3: c.cca3,
    flag: { png: c.flags.png, svg: c.flags.svg, alt: c.flags.alt || null },
    capital: c.capital?.[0] || null,
    region: c.region,
    subregion: c.subregion || null,
    population: c.population,
    languages: c.languages ? Object.values(c.languages) : [],
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'country-flags',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_flag: { costCents: 1, displayName: 'Get Flag' },
      search_flags: { costCents: 1, displayName: 'Search Flags' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getFlag = sg.wrap(async (args: GetFlagInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(code)) throw new Error('code must be a 2-letter ISO country code (e.g. "US")')
  const data = await countriesFetch<CountryData[]>(\`/alpha/\${code}?fields=\${FIELDS}\`)
  const country = Array.isArray(data) ? data[0] : data
  return formatCountry(country as CountryData)
}, { method: 'get_flag' })

const searchFlags = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await countriesFetch<CountryData[]>(\`/name/\${encodeURIComponent(name)}?fields=\${FIELDS}\`)
  return { query: name, count: data.length, countries: data.slice(0, 10).map(formatCountry) }
}, { method: 'search_flags' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getFlag, searchFlags }

console.log('settlegrid-country-flags MCP server ready')
console.log('Methods: get_flag, search_flags')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 266. settlegrid-rest-countries-v2 ────────────────────────────────────────

generateServer({
  slug: 'rest-countries-v2',
  name: 'REST Countries Extended',
  description: 'Extended country data including currencies, borders, timezones, and demographics via REST Countries API.',
  keywords: ['education', 'countries', 'geography', 'demographics', 'currencies'],
  upstream: { provider: 'REST Countries', baseUrl: 'https://restcountries.com/v3.1', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://restcountries.com/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_country', displayName: 'Get Country', costCents: 1, description: 'Get comprehensive country data by code', params: [{ name: 'code', type: 'string', required: true, description: 'ISO 3166-1 alpha-2 code (e.g. "US", "DE")' }] },
    { name: 'search_countries', displayName: 'Search Countries', costCents: 1, description: 'Search countries by name', params: [{ name: 'name', type: 'string', required: true, description: 'Country name to search' }] },
    { name: 'get_by_region', displayName: 'Get by Region', costCents: 1, description: 'Get all countries in a region', params: [{ name: 'region', type: 'string', required: true, description: 'Region name (Africa, Americas, Asia, Europe, Oceania)' }] },
  ],
  serverTs: `/**
 * settlegrid-rest-countries-v2 — REST Countries Extended MCP Server
 *
 * Wraps REST Countries API for comprehensive country data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_country(code)       — Full country data by code   (1¢)
 *   search_countries(name)  — Search by name              (1¢)
 *   get_by_region(region)   — Countries in a region       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetCountryInput { code: string }
interface SearchInput { name: string }
interface RegionInput { region: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://restcountries.com/v3.1'
const VALID_REGIONS = new Set(['africa', 'americas', 'asia', 'europe', 'oceania'])

async function rcFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`REST Countries API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatCountry(c: Record<string, unknown>) {
  const name = c.name as Record<string, unknown>
  const currencies = c.currencies as Record<string, { name: string; symbol: string }> | undefined
  return {
    name: (name.common as string),
    officialName: (name.official as string),
    code: c.cca2,
    code3: c.cca3,
    capital: (c.capital as string[]) || [],
    region: c.region,
    subregion: c.subregion || null,
    population: c.population,
    area: c.area || null,
    currencies: currencies ? Object.entries(currencies).map(([code, v]) => ({ code, name: v.name, symbol: v.symbol })) : [],
    languages: c.languages ? Object.values(c.languages as Record<string, string>) : [],
    borders: (c.borders as string[]) || [],
    timezones: (c.timezones as string[]) || [],
    flag: ((c.flags as Record<string, string>)?.svg) || null,
    independent: c.independent ?? null,
    landlocked: c.landlocked ?? null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'rest-countries-v2',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_country: { costCents: 1, displayName: 'Get Country' },
      search_countries: { costCents: 1, displayName: 'Search Countries' },
      get_by_region: { costCents: 1, displayName: 'Get by Region' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCountry = sg.wrap(async (args: GetCountryInput) => {
  if (!args.code || typeof args.code !== 'string') throw new Error('code is required')
  const code = args.code.toUpperCase().trim()
  if (!/^[A-Z]{2,3}$/.test(code)) throw new Error('code must be a 2 or 3 letter country code')
  const data = await rcFetch<Record<string, unknown>[]>(\`/alpha/\${code}\`)
  return formatCountry(Array.isArray(data) ? data[0] : data)
}, { method: 'get_country' })

const searchCountries = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await rcFetch<Record<string, unknown>[]>(\`/name/\${encodeURIComponent(name)}\`)
  return { query: name, count: data.length, countries: data.slice(0, 15).map(formatCountry) }
}, { method: 'search_countries' })

const getByRegion = sg.wrap(async (args: RegionInput) => {
  if (!args.region || typeof args.region !== 'string') throw new Error('region is required')
  const region = args.region.toLowerCase().trim()
  if (!VALID_REGIONS.has(region)) {
    throw new Error(\`region must be one of: \${[...VALID_REGIONS].join(', ')}\`)
  }
  const data = await rcFetch<Record<string, unknown>[]>(\`/region/\${region}\`)
  return { region, count: data.length, countries: data.map(c => ({ name: (c.name as Record<string, string>).common, code: c.cca2, population: c.population })) }
}, { method: 'get_by_region' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCountry, searchCountries, getByRegion }

console.log('settlegrid-rest-countries-v2 MCP server ready')
console.log('Methods: get_country, search_countries, get_by_region')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 267. settlegrid-university-domains ───────────────────────────────────────

generateServer({
  slug: 'university-domains',
  name: 'University Domains',
  description: 'Search universities worldwide by name, country, or domain via the Hipo Labs API.',
  keywords: ['education', 'universities', 'colleges', 'domains', 'schools'],
  upstream: { provider: 'Hipo Labs', baseUrl: 'http://universities.hipolabs.com', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://github.com/Hipo/university-domains-list' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_universities', displayName: 'Search Universities', costCents: 1, description: 'Search universities by name', params: [{ name: 'name', type: 'string', required: true, description: 'University name to search' }] },
    { name: 'search_by_country', displayName: 'Search by Country', costCents: 1, description: 'Search universities in a specific country', params: [{ name: 'country', type: 'string', required: true, description: 'Country name (e.g. "United States", "Germany")' }, { name: 'name', type: 'string', required: false, description: 'Optional name filter' }] },
  ],
  serverTs: `/**
 * settlegrid-university-domains — University Domains MCP Server
 *
 * Wraps the Hipo Labs University Domains API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_universities(name)           — Search universities        (1¢)
 *   search_by_country(country, name?)   — Universities by country    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { name: string }
interface CountrySearchInput { country: string; name?: string }

interface University {
  name: string
  country: string
  alpha_two_code: string
  domains: string[]
  web_pages: string[]
  'state-province': string | null
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'http://universities.hipolabs.com'

async function uniFetch(path: string): Promise<University[]> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`University API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<University[]>
}

function formatUni(u: University) {
  return {
    name: u.name,
    country: u.country,
    countryCode: u.alpha_two_code,
    domains: u.domains,
    websites: u.web_pages,
    stateProvince: u['state-province'],
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'university-domains',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_universities: { costCents: 1, displayName: 'Search Universities' },
      search_by_country: { costCents: 1, displayName: 'Search by Country' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchUniversities = sg.wrap(async (args: SearchInput) => {
  if (!args.name || typeof args.name !== 'string') throw new Error('name is required')
  const name = args.name.trim()
  if (name.length === 0 || name.length > 100) throw new Error('name must be 1-100 characters')
  const data = await uniFetch(\`/search?name=\${encodeURIComponent(name)}\`)
  return { query: name, count: data.length, universities: data.slice(0, 25).map(formatUni) }
}, { method: 'search_universities' })

const searchByCountry = sg.wrap(async (args: CountrySearchInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.trim()
  if (country.length === 0 || country.length > 100) throw new Error('country must be 1-100 characters')
  let url = \`/search?country=\${encodeURIComponent(country)}\`
  if (args.name && typeof args.name === 'string') {
    url += \`&name=\${encodeURIComponent(args.name.trim())}\`
  }
  const data = await uniFetch(url)
  return { country, name: args.name || null, count: data.length, universities: data.slice(0, 25).map(formatUni) }
}, { method: 'search_by_country' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchUniversities, searchByCountry }

console.log('settlegrid-university-domains MCP server ready')
console.log('Methods: search_universities, search_by_country')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 268. settlegrid-timezone-api ─────────────────────────────────────────────

generateServer({
  slug: 'timezone-api',
  name: 'World Timezone',
  description: 'Get current time, timezone data, and UTC offsets for any timezone worldwide.',
  keywords: ['education', 'timezone', 'time', 'utc', 'world-clock'],
  upstream: { provider: 'WorldTimeAPI', baseUrl: 'https://worldtimeapi.org/api', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'http://worldtimeapi.org/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_time', displayName: 'Get Time', costCents: 1, description: 'Get current time for a timezone', params: [{ name: 'timezone', type: 'string', required: true, description: 'IANA timezone (e.g. "America/New_York", "Europe/London")' }] },
    { name: 'get_time_by_ip', displayName: 'Get Time by IP', costCents: 1, description: 'Get current time based on IP geolocation', params: [{ name: 'ip', type: 'string', required: false, description: 'IP address (omit for your own IP)' }] },
    { name: 'list_timezones', displayName: 'List Timezones', costCents: 1, description: 'List all available IANA timezones', params: [] },
  ],
  serverTs: `/**
 * settlegrid-timezone-api — World Timezone MCP Server
 *
 * Wraps the WorldTimeAPI with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_time(timezone)    — Current time for timezone  (1¢)
 *   get_time_by_ip(ip?)   — Time by IP geolocation     (1¢)
 *   list_timezones()      — List all timezones          (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface TimezoneInput { timezone: string }
interface IpInput { ip?: string }

interface TimeResponse {
  timezone: string
  datetime: string
  utc_datetime: string
  utc_offset: string
  day_of_week: number
  day_of_year: number
  week_number: number
  abbreviation: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://worldtimeapi.org/api'

async function timeFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Timezone not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`WorldTimeAPI \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatTime(t: TimeResponse) {
  return {
    timezone: t.timezone,
    datetime: t.datetime,
    utcDatetime: t.utc_datetime,
    utcOffset: t.utc_offset,
    dayOfWeek: t.day_of_week,
    dayOfYear: t.day_of_year,
    weekNumber: t.week_number,
    abbreviation: t.abbreviation,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'timezone-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_time: { costCents: 1, displayName: 'Get Time' },
      get_time_by_ip: { costCents: 1, displayName: 'Get Time by IP' },
      list_timezones: { costCents: 1, displayName: 'List Timezones' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getTime = sg.wrap(async (args: TimezoneInput) => {
  if (!args.timezone || typeof args.timezone !== 'string') throw new Error('timezone is required (e.g. "America/New_York")')
  const tz = args.timezone.trim()
  if (!/^[A-Za-z_]+\\/[A-Za-z_\\/]+$/.test(tz)) throw new Error('Invalid timezone format. Use IANA format (e.g. "America/New_York")')
  const data = await timeFetch<TimeResponse>(\`/timezone/\${tz}\`)
  return formatTime(data)
}, { method: 'get_time' })

const getTimeByIp = sg.wrap(async (args: IpInput) => {
  const ipPath = args.ip ? \`/\${args.ip.trim()}\` : ''
  if (args.ip && !/^[\\d.:a-fA-F]+$/.test(args.ip.trim())) throw new Error('Invalid IP address format')
  const data = await timeFetch<TimeResponse>(\`/ip\${ipPath}\`)
  return formatTime(data)
}, { method: 'get_time_by_ip' })

const listTimezones = sg.wrap(async () => {
  const data = await timeFetch<string[]>('/timezone')
  return { count: data.length, timezones: data }
}, { method: 'list_timezones' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getTime, getTimeByIp, listTimezones }

console.log('settlegrid-timezone-api MCP server ready')
console.log('Methods: get_time, get_time_by_ip, list_timezones')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 269. settlegrid-calendar-api ─────────────────────────────────────────────

generateServer({
  slug: 'calendar-api',
  name: 'Calendar & Date API',
  description: 'Get calendar data, date calculations, and day-of-year information.',
  keywords: ['education', 'calendar', 'dates', 'time', 'holidays'],
  upstream: { provider: 'WorldTimeAPI + date.nager.at', baseUrl: 'https://worldtimeapi.org/api', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'http://worldtimeapi.org/' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_current_date', displayName: 'Current Date Info', costCents: 1, description: 'Get detailed current date info for a timezone', params: [{ name: 'timezone', type: 'string', required: true, description: 'IANA timezone (e.g. "America/New_York")' }] },
    { name: 'get_holidays', displayName: 'Get Holidays', costCents: 1, description: 'Get public holidays for a country and year', params: [{ name: 'country', type: 'string', required: true, description: 'ISO 3166-1 alpha-2 country code' }, { name: 'year', type: 'number', required: true, description: 'Year (e.g. 2026)' }] },
  ],
  serverTs: `/**
 * settlegrid-calendar-api — Calendar & Date MCP Server
 *
 * Wraps WorldTimeAPI + Nager.Date for calendar data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_current_date(timezone)     — Current date info      (1¢)
 *   get_holidays(country, year)    — Public holidays         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DateInput { timezone: string }
interface HolidayInput { country: string; year: number }

interface HolidayEntry {
  date: string
  localName: string
  name: string
  countryCode: string
  fixed: boolean
  global: boolean
  types: string[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIME_BASE = 'https://worldtimeapi.org/api'
const HOLIDAY_BASE = 'https://date.nager.at/api/v3'

async function apiFetch<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'calendar-api',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_current_date: { costCents: 1, displayName: 'Current Date Info' },
      get_holidays: { costCents: 1, displayName: 'Get Holidays' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getCurrentDate = sg.wrap(async (args: DateInput) => {
  if (!args.timezone || typeof args.timezone !== 'string') throw new Error('timezone is required')
  const tz = args.timezone.trim()
  if (!/^[A-Za-z_]+\\/[A-Za-z_\\/]+$/.test(tz)) throw new Error('Invalid timezone format')

  const data = await apiFetch<{
    datetime: string; utc_datetime: string; utc_offset: string
    day_of_week: number; day_of_year: number; week_number: number
    timezone: string; abbreviation: string
  }>(\`\${TIME_BASE}/timezone/\${tz}\`)

  const dt = new Date(data.datetime)
  const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

  return {
    timezone: data.timezone,
    datetime: data.datetime,
    utcOffset: data.utc_offset,
    dayOfWeek: DAYS[data.day_of_week],
    dayOfYear: data.day_of_year,
    weekNumber: data.week_number,
    month: MONTHS[dt.getMonth()],
    year: dt.getFullYear(),
    isLeapYear: dt.getFullYear() % 4 === 0 && (dt.getFullYear() % 100 !== 0 || dt.getFullYear() % 400 === 0),
    daysInYear: dt.getFullYear() % 4 === 0 && (dt.getFullYear() % 100 !== 0 || dt.getFullYear() % 400 === 0) ? 366 : 365,
  }
}, { method: 'get_current_date' })

const getHolidays = sg.wrap(async (args: HolidayInput) => {
  if (!args.country || typeof args.country !== 'string') throw new Error('country is required')
  const country = args.country.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(country)) throw new Error('country must be a 2-letter ISO code')
  if (typeof args.year !== 'number' || args.year < 1900 || args.year > 2100) throw new Error('year must be between 1900 and 2100')
  const year = Math.round(args.year)
  const data = await apiFetch<HolidayEntry[]>(\`\${HOLIDAY_BASE}/PublicHolidays/\${year}/\${country}\`)
  return {
    country,
    year,
    count: data.length,
    holidays: data.map(h => ({
      date: h.date,
      name: h.name,
      localName: h.localName,
      global: h.global,
      types: h.types,
    })),
  }
}, { method: 'get_holidays' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getCurrentDate, getHolidays }

console.log('settlegrid-calendar-api MCP server ready')
console.log('Methods: get_current_date, get_holidays')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 270. settlegrid-holidays-worldwide ───────────────────────────────────────

generateServer({
  slug: 'holidays-worldwide',
  name: 'Holidays Worldwide',
  description: 'Get public holidays, long weekends, and available countries via the Nager.Date API.',
  keywords: ['education', 'holidays', 'countries', 'calendar', 'public-holidays'],
  upstream: { provider: 'Nager.Date', baseUrl: 'https://date.nager.at/api/v3', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://date.nager.at/Api' },
  auth: { type: 'none' },
  methods: [
    { name: 'get_holidays', displayName: 'Get Holidays', costCents: 1, description: 'Get public holidays for a country and year', params: [{ name: 'country', type: 'string', required: true, description: '2-letter country code' }, { name: 'year', type: 'number', required: true, description: 'Year (e.g. 2026)' }] },
    { name: 'get_long_weekends', displayName: 'Long Weekends', costCents: 1, description: 'Get long weekends for a country and year', params: [{ name: 'country', type: 'string', required: true, description: '2-letter country code' }, { name: 'year', type: 'number', required: true, description: 'Year (e.g. 2026)' }] },
    { name: 'next_holiday', displayName: 'Next Holiday', costCents: 1, description: 'Get the next upcoming public holiday', params: [{ name: 'country', type: 'string', required: true, description: '2-letter country code' }] },
  ],
  serverTs: `/**
 * settlegrid-holidays-worldwide — Holidays Worldwide MCP Server
 *
 * Wraps the Nager.Date API for public holidays with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_holidays(country, year)        — Public holidays          (1¢)
 *   get_long_weekends(country, year)   — Long weekends            (1¢)
 *   next_holiday(country)              — Next upcoming holiday    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface HolidayInput { country: string; year: number }
interface NextInput { country: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://date.nager.at/api/v3'

async function nagerFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Country not found or no data available')
    const body = await res.text().catch(() => '')
    throw new Error(\`Nager.Date API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateCountry(code: string): string {
  if (!code || typeof code !== 'string') throw new Error('country is required')
  const upper = code.toUpperCase().trim()
  if (!/^[A-Z]{2}$/.test(upper)) throw new Error('country must be a 2-letter ISO code')
  return upper
}

function validateYear(year: number): number {
  if (typeof year !== 'number' || year < 1900 || year > 2100) throw new Error('year must be between 1900 and 2100')
  return Math.round(year)
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'holidays-worldwide',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_holidays: { costCents: 1, displayName: 'Get Holidays' },
      get_long_weekends: { costCents: 1, displayName: 'Long Weekends' },
      next_holiday: { costCents: 1, displayName: 'Next Holiday' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getHolidays = sg.wrap(async (args: HolidayInput) => {
  const country = validateCountry(args.country)
  const year = validateYear(args.year)
  const data = await nagerFetch<Array<{ date: string; localName: string; name: string; global: boolean; types: string[] }>>(\`/PublicHolidays/\${year}/\${country}\`)
  return { country, year, count: data.length, holidays: data.map(h => ({ date: h.date, name: h.name, localName: h.localName, global: h.global, types: h.types })) }
}, { method: 'get_holidays' })

const getLongWeekends = sg.wrap(async (args: HolidayInput) => {
  const country = validateCountry(args.country)
  const year = validateYear(args.year)
  const data = await nagerFetch<Array<{ startDate: string; endDate: string; dayCount: number; needBridgeDay: boolean }>>(\`/LongWeekend/\${year}/\${country}\`)
  return { country, year, count: data.length, longWeekends: data }
}, { method: 'get_long_weekends' })

const nextHoliday = sg.wrap(async (args: NextInput) => {
  const country = validateCountry(args.country)
  const data = await nagerFetch<Array<{ date: string; localName: string; name: string; global: boolean; types: string[] }>>(\`/NextPublicHolidays/\${country}\`)
  const next = data[0]
  return next
    ? { country, date: next.date, name: next.name, localName: next.localName, global: next.global, types: next.types, totalUpcoming: data.length }
    : { country, message: 'No upcoming holidays found' }
}, { method: 'next_holiday' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getHolidays, getLongWeekends, nextHoliday }

console.log('settlegrid-holidays-worldwide MCP server ready')
console.log('Methods: get_holidays, get_long_weekends, next_holiday')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

console.log('\n=== Business/Commerce Servers (271-285) ===\n')

// ─── 271. settlegrid-clearbit ─────────────────────────────────────────────────

generateServer({
  slug: 'clearbit',
  name: 'Clearbit Company Data',
  description: 'Enrich company data by domain, get logo URLs, and look up company information via Clearbit.',
  keywords: ['business', 'company', 'enrichment', 'clearbit', 'data'],
  upstream: { provider: 'Clearbit', baseUrl: 'https://company.clearbit.com/v2', auth: 'Bearer token required', rateLimit: 'Free tier available', docsUrl: 'https://clearbit.com/docs' },
  auth: { type: 'bearer', keyEnvVar: 'CLEARBIT_API_KEY', keyDesc: 'Clearbit API key' },
  methods: [
    { name: 'enrich_company', displayName: 'Enrich Company', costCents: 2, description: 'Get company data by domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain (e.g. "stripe.com")' }] },
    { name: 'get_logo', displayName: 'Get Logo', costCents: 1, description: 'Get company logo URL by domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain' }] },
  ],
  serverTs: `/**
 * settlegrid-clearbit — Clearbit Company Data MCP Server
 *
 * Wraps the Clearbit API for company enrichment with SettleGrid billing.
 * Requires a Clearbit API key (free tier available).
 *
 * Methods:
 *   enrich_company(domain)  — Enrich company by domain  (2¢)
 *   get_logo(domain)        — Get company logo URL      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://company.clearbit.com/v2'
const LOGO_BASE = 'https://logo.clearbit.com'
const API_KEY = process.env.CLEARBIT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$/

async function clearbitFetch<T>(url: string): Promise<T> {
  if (!API_KEY) throw new Error('CLEARBIT_API_KEY environment variable is required')
  const res = await fetch(url, { headers: { Authorization: \`Bearer \${API_KEY}\` } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Company not found for this domain')
    if (res.status === 401) throw new Error('Invalid Clearbit API key')
    const body = await res.text().catch(() => '')
    throw new Error(\`Clearbit API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function validateDomain(domain: string): string {
  if (!domain || typeof domain !== 'string') throw new Error('domain is required')
  const d = domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(d)) throw new Error('Invalid domain format (e.g. "stripe.com")')
  return d
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'clearbit',
  pricing: {
    defaultCostCents: 2,
    methods: {
      enrich_company: { costCents: 2, displayName: 'Enrich Company' },
      get_logo: { costCents: 1, displayName: 'Get Logo' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const enrichCompany = sg.wrap(async (args: DomainInput) => {
  const domain = validateDomain(args.domain)
  const data = await clearbitFetch<Record<string, unknown>>(\`\${API_BASE}/companies/find?domain=\${domain}\`)
  return {
    domain,
    name: data.name,
    legalName: data.legalName || null,
    description: data.description || null,
    sector: data.sector || null,
    industry: data.industry || null,
    tags: data.tags || [],
    location: data.location || null,
    employees: data.metrics ? (data.metrics as Record<string, unknown>).employees : null,
    raised: data.metrics ? (data.metrics as Record<string, unknown>).raised : null,
    foundedYear: data.foundedYear || null,
    logo: data.logo || null,
    url: data.url || null,
  }
}, { method: 'enrich_company' })

const getLogo = sg.wrap(async (args: DomainInput) => {
  const domain = validateDomain(args.domain)
  return { domain, logoUrl: \`\${LOGO_BASE}/\${domain}\`, format: 'png', sizes: { default: \`\${LOGO_BASE}/\${domain}\`, small: \`\${LOGO_BASE}/\${domain}?size=64\`, large: \`\${LOGO_BASE}/\${domain}?size=256\` } }
}, { method: 'get_logo' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { enrichCompany, getLogo }

console.log('settlegrid-clearbit MCP server ready')
console.log('Methods: enrich_company, get_logo')
console.log('Pricing: 1-2¢ per call | Powered by SettleGrid')
`,
})

// ─── 272. settlegrid-hunter-io ────────────────────────────────────────────────

generateServer({
  slug: 'hunter-io',
  name: 'Hunter.io Email Finder',
  description: 'Find professional email addresses, verify emails, and search domains via Hunter.io.',
  keywords: ['business', 'email', 'hunter', 'leads', 'contacts'],
  upstream: { provider: 'Hunter.io', baseUrl: 'https://api.hunter.io/v2', auth: 'API key required (query param)', rateLimit: '25 free requests/month', docsUrl: 'https://hunter.io/api-documentation' },
  auth: { type: 'query', keyEnvVar: 'HUNTER_API_KEY', keyDesc: 'Hunter.io API key' },
  methods: [
    { name: 'domain_search', displayName: 'Domain Search', costCents: 2, description: 'Find email addresses for a domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain (e.g. "stripe.com")' }] },
    { name: 'email_finder', displayName: 'Email Finder', costCents: 2, description: 'Find email for a person at a company', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain' }, { name: 'first_name', type: 'string', required: true, description: 'Person first name' }, { name: 'last_name', type: 'string', required: true, description: 'Person last name' }] },
    { name: 'email_verifier', displayName: 'Email Verifier', costCents: 2, description: 'Verify if an email address is valid', params: [{ name: 'email', type: 'string', required: true, description: 'Email address to verify' }] },
  ],
  serverTs: `/**
 * settlegrid-hunter-io — Hunter.io Email Finder MCP Server
 *
 * Wraps the Hunter.io API with SettleGrid billing.
 * Requires a Hunter.io API key (free tier: 25/month).
 *
 * Methods:
 *   domain_search(domain)                       — Find emails for domain  (2¢)
 *   email_finder(domain, first_name, last_name) — Find person's email    (2¢)
 *   email_verifier(email)                       — Verify email validity   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainSearchInput { domain: string }
interface EmailFinderInput { domain: string; first_name: string; last_name: string }
interface EmailVerifierInput { email: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.hunter.io/v2'
const API_KEY = process.env.HUNTER_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$/
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/

async function hunterFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('HUNTER_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API_BASE}\${path}\${separator}api_key=\${API_KEY}\`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Hunter.io API key')
    if (res.status === 429) throw new Error('Hunter.io rate limit exceeded')
    const body = await res.text().catch(() => '')
    throw new Error(\`Hunter.io API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'hunter-io',
  pricing: {
    defaultCostCents: 2,
    methods: {
      domain_search: { costCents: 2, displayName: 'Domain Search' },
      email_finder: { costCents: 2, displayName: 'Email Finder' },
      email_verifier: { costCents: 2, displayName: 'Email Verifier' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const domainSearch = sg.wrap(async (args: DomainSearchInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await hunterFetch<{ data: { domain: string; organization: string; emails: Array<{ value: string; type: string; confidence: number; first_name: string; last_name: string; position: string }> } }>(\`/domain-search?domain=\${domain}\`)
  return {
    domain: data.data.domain,
    organization: data.data.organization,
    emails: data.data.emails.slice(0, 15).map(e => ({
      email: e.value, type: e.type, confidence: e.confidence,
      name: \`\${e.first_name} \${e.last_name}\`.trim(), position: e.position || null,
    })),
  }
}, { method: 'domain_search' })

const emailFinder = sg.wrap(async (args: EmailFinderInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  if (!args.first_name || typeof args.first_name !== 'string') throw new Error('first_name is required')
  if (!args.last_name || typeof args.last_name !== 'string') throw new Error('last_name is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await hunterFetch<{ data: { email: string; score: number; position: string; company: string } }>(\`/email-finder?domain=\${domain}&first_name=\${encodeURIComponent(args.first_name)}&last_name=\${encodeURIComponent(args.last_name)}\`)
  return { domain, firstName: args.first_name, lastName: args.last_name, email: data.data.email, confidence: data.data.score, position: data.data.position || null, company: data.data.company || null }
}, { method: 'email_finder' })

const emailVerifier = sg.wrap(async (args: EmailVerifierInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('Invalid email format')
  const data = await hunterFetch<{ data: { email: string; result: string; score: number; regexp: boolean; gibberish: boolean; disposable: boolean; webmail: boolean; mx_records: boolean; smtp_server: boolean; smtp_check: boolean } }>(\`/email-verifier?email=\${encodeURIComponent(email)}\`)
  return {
    email: data.data.email, result: data.data.result, score: data.data.score,
    checks: { validFormat: data.data.regexp, notGibberish: !data.data.gibberish, notDisposable: !data.data.disposable, isWebmail: data.data.webmail, hasMX: data.data.mx_records, smtpValid: data.data.smtp_check },
  }
}, { method: 'email_verifier' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { domainSearch, emailFinder, emailVerifier }

console.log('settlegrid-hunter-io MCP server ready')
console.log('Methods: domain_search, email_finder, email_verifier')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 273. settlegrid-abstract-api ─────────────────────────────────────────────

generateServer({
  slug: 'abstract-api',
  name: 'Abstract API',
  description: 'Enrich company data, validate emails, and geolocate IPs via Abstract API.',
  keywords: ['business', 'company', 'email', 'ip', 'enrichment'],
  upstream: { provider: 'Abstract API', baseUrl: 'https://companyenrichment.abstractapi.com/v1', auth: 'API key required (query param)', rateLimit: 'Free tier available', docsUrl: 'https://www.abstractapi.com/api' },
  auth: { type: 'query', keyEnvVar: 'ABSTRACT_API_KEY', keyDesc: 'Abstract API key' },
  methods: [
    { name: 'enrich_company', displayName: 'Enrich Company', costCents: 2, description: 'Get company data by domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain (e.g. "stripe.com")' }] },
    { name: 'validate_email', displayName: 'Validate Email', costCents: 2, description: 'Validate and check an email address', params: [{ name: 'email', type: 'string', required: true, description: 'Email to validate' }] },
    { name: 'geolocate_ip', displayName: 'Geolocate IP', costCents: 2, description: 'Get geolocation data for an IP address', params: [{ name: 'ip', type: 'string', required: true, description: 'IP address to geolocate' }] },
  ],
  serverTs: `/**
 * settlegrid-abstract-api — Abstract API MCP Server
 *
 * Wraps Abstract API for company/email/IP data with SettleGrid billing.
 * Requires an Abstract API key (free tier available).
 *
 * Methods:
 *   enrich_company(domain)  — Company enrichment    (2¢)
 *   validate_email(email)   — Email validation      (2¢)
 *   geolocate_ip(ip)        — IP geolocation        (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }
interface EmailInput { email: string }
interface IpInput { ip: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_KEY = process.env.ABSTRACT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$/
const EMAIL_RE = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/
const IP_RE = /^[\\d.:a-fA-F]+$/

async function abstractFetch<T>(baseUrl: string, params: string): Promise<T> {
  if (!API_KEY) throw new Error('ABSTRACT_API_KEY environment variable is required')
  const res = await fetch(\`\${baseUrl}?api_key=\${API_KEY}&\${params}\`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Abstract API key')
    const body = await res.text().catch(() => '')
    throw new Error(\`Abstract API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'abstract-api',
  pricing: {
    defaultCostCents: 2,
    methods: {
      enrich_company: { costCents: 2, displayName: 'Enrich Company' },
      validate_email: { costCents: 2, displayName: 'Validate Email' },
      geolocate_ip: { costCents: 2, displayName: 'Geolocate IP' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const enrichCompany = sg.wrap(async (args: DomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await abstractFetch<Record<string, unknown>>('https://companyenrichment.abstractapi.com/v1', \`domain=\${domain}\`)
  return { domain, name: data.name, country: data.country, industry: data.industry, employees: data.employees_count, founded: data.year_founded, type: data.type, linkedin: data.linkedin_url || null }
}, { method: 'enrich_company' })

const validateEmail = sg.wrap(async (args: EmailInput) => {
  if (!args.email || typeof args.email !== 'string') throw new Error('email is required')
  const email = args.email.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) throw new Error('Invalid email format')
  const data = await abstractFetch<Record<string, unknown>>('https://emailvalidation.abstractapi.com/v1', \`email=\${encodeURIComponent(email)}\`)
  return { email, deliverability: data.deliverability, qualityScore: data.quality_score, isValidFormat: data.is_valid_format, isFreeEmail: data.is_free_email, isDisposable: data.is_disposable_email, isMxFound: data.is_mx_found, isSmtpValid: data.is_smtp_valid }
}, { method: 'validate_email' })

const geolocateIp = sg.wrap(async (args: IpInput) => {
  if (!args.ip || typeof args.ip !== 'string') throw new Error('ip is required')
  const ip = args.ip.trim()
  if (!IP_RE.test(ip)) throw new Error('Invalid IP address format')
  const data = await abstractFetch<Record<string, unknown>>('https://ipgeolocation.abstractapi.com/v1', \`ip_address=\${ip}\`)
  return { ip, city: data.city, region: data.region, country: data.country, countryCode: data.country_code, continent: data.continent, latitude: data.latitude, longitude: data.longitude, timezone: data.timezone, isp: data.connection ? (data.connection as Record<string, unknown>).isp_name : null }
}, { method: 'geolocate_ip' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { enrichCompany, validateEmail, geolocateIp }

console.log('settlegrid-abstract-api MCP server ready')
console.log('Methods: enrich_company, validate_email, geolocate_ip')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 274. settlegrid-brandfetch ───────────────────────────────────────────────

generateServer({
  slug: 'brandfetch',
  name: 'Brandfetch',
  description: 'Get brand assets including logos, colors, and fonts for any company via Brandfetch.',
  keywords: ['business', 'brand', 'logos', 'design', 'colors'],
  upstream: { provider: 'Brandfetch', baseUrl: 'https://api.brandfetch.io/v2', auth: 'Bearer token required', rateLimit: 'Free tier: 10 requests/month', docsUrl: 'https://docs.brandfetch.com/' },
  auth: { type: 'bearer', keyEnvVar: 'BRANDFETCH_API_KEY', keyDesc: 'Brandfetch API key' },
  methods: [
    { name: 'get_brand', displayName: 'Get Brand', costCents: 2, description: 'Get brand data (logos, colors, fonts) by domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Company domain (e.g. "stripe.com")' }] },
    { name: 'search_brands', displayName: 'Search Brands', costCents: 2, description: 'Search for brands by name', params: [{ name: 'query', type: 'string', required: true, description: 'Brand name to search' }] },
  ],
  serverTs: `/**
 * settlegrid-brandfetch — Brandfetch Brand Data MCP Server
 *
 * Wraps the Brandfetch API for brand assets with SettleGrid billing.
 * Requires a Brandfetch API key.
 *
 * Methods:
 *   get_brand(domain)     — Brand data by domain   (2¢)
 *   search_brands(query)  — Search brands by name  (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface DomainInput { domain: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.brandfetch.io/v2'
const API_KEY = process.env.BRANDFETCH_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$/

async function brandfetchFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BRANDFETCH_API_KEY environment variable is required')
  const res = await fetch(\`\${API_BASE}\${path}\`, { headers: { Authorization: \`Bearer \${API_KEY}\` } })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Brand not found')
    if (res.status === 401) throw new Error('Invalid Brandfetch API key')
    const body = await res.text().catch(() => '')
    throw new Error(\`Brandfetch API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'brandfetch',
  pricing: {
    defaultCostCents: 2,
    methods: {
      get_brand: { costCents: 2, displayName: 'Get Brand' },
      search_brands: { costCents: 2, displayName: 'Search Brands' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getBrand = sg.wrap(async (args: DomainInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  const data = await brandfetchFetch<Record<string, unknown>>(\`/brands/\${domain}\`)
  const logos = (data.logos as Array<Record<string, unknown>> || []).map(l => ({
    type: l.type, theme: l.theme,
    formats: ((l.formats as Array<Record<string, unknown>>) || []).map(f => ({ src: f.src, format: f.format })),
  }))
  const colors = (data.colors as Array<Record<string, unknown>> || []).map(c => ({ hex: c.hex, type: c.type, brightness: c.brightness }))
  const fonts = (data.fonts as Array<Record<string, unknown>> || []).map(f => ({ name: f.name, type: f.type, origin: f.origin }))
  return { domain, name: data.name, description: data.description || null, logos: logos.slice(0, 10), colors: colors.slice(0, 10), fonts: fonts.slice(0, 5) }
}, { method: 'get_brand' })

const searchBrands = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await brandfetchFetch<Array<Record<string, unknown>>>(\`/search/\${encodeURIComponent(query)}\`)
  return { query, count: data.length, brands: data.slice(0, 15).map(b => ({ name: b.name, domain: b.domain, icon: b.icon || null, claimed: b.claimed || false })) }
}, { method: 'search_brands' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getBrand, searchBrands }

console.log('settlegrid-brandfetch MCP server ready')
console.log('Methods: get_brand, search_brands')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 275. settlegrid-barcode-lookup ───────────────────────────────────────────

generateServer({
  slug: 'barcode-lookup',
  name: 'Barcode Lookup',
  description: 'Look up product information by UPC, EAN, or ISBN barcode via Barcode Lookup.',
  keywords: ['business', 'barcode', 'upc', 'ean', 'products'],
  upstream: { provider: 'Barcode Lookup', baseUrl: 'https://api.barcodelookup.com/v3', auth: 'API key required (query param)', rateLimit: 'Free trial available', docsUrl: 'https://www.barcodelookup.com/api' },
  auth: { type: 'query', keyEnvVar: 'BARCODE_LOOKUP_API_KEY', keyDesc: 'Barcode Lookup API key' },
  methods: [
    { name: 'lookup_barcode', displayName: 'Lookup Barcode', costCents: 2, description: 'Get product info by barcode number', params: [{ name: 'barcode', type: 'string', required: true, description: 'UPC, EAN, or ISBN barcode number' }] },
    { name: 'search_products', displayName: 'Search Products', costCents: 2, description: 'Search products by name or keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Product name or keyword' }] },
  ],
  serverTs: `/**
 * settlegrid-barcode-lookup — Barcode Lookup MCP Server
 *
 * Wraps the Barcode Lookup API with SettleGrid billing.
 * Requires a Barcode Lookup API key.
 *
 * Methods:
 *   lookup_barcode(barcode)   — Product info by barcode  (2¢)
 *   search_products(query)    — Search products          (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface BarcodeInput { barcode: string }
interface SearchInput { query: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.barcodelookup.com/v3'
const API_KEY = process.env.BARCODE_LOOKUP_API_KEY || ''
const BARCODE_RE = /^[0-9]{8,14}$/

async function barcodeFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('BARCODE_LOOKUP_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API_BASE}\${path}\${separator}key=\${API_KEY}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Product not found')
    if (res.status === 403) throw new Error('Invalid or expired API key')
    const body = await res.text().catch(() => '')
    throw new Error(\`Barcode Lookup API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatProduct(p: Record<string, unknown>) {
  return {
    barcode: p.barcode_number,
    name: p.title || p.product_name,
    description: ((p.description as string) || '').slice(0, 500),
    brand: p.brand || null,
    manufacturer: p.manufacturer || null,
    category: p.category || null,
    images: ((p.images as string[]) || []).slice(0, 5),
    stores: ((p.stores as Array<Record<string, unknown>>) || []).slice(0, 5).map(s => ({
      name: s.store_name, price: s.store_price, url: s.product_url,
    })),
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'barcode-lookup',
  pricing: {
    defaultCostCents: 2,
    methods: {
      lookup_barcode: { costCents: 2, displayName: 'Lookup Barcode' },
      search_products: { costCents: 2, displayName: 'Search Products' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const lookupBarcode = sg.wrap(async (args: BarcodeInput) => {
  if (!args.barcode || typeof args.barcode !== 'string') throw new Error('barcode is required')
  const barcode = args.barcode.trim()
  if (!BARCODE_RE.test(barcode)) throw new Error('barcode must be 8-14 digits (UPC/EAN/ISBN)')
  const data = await barcodeFetch<{ products: Array<Record<string, unknown>> }>(\`/products?barcode=\${barcode}\`)
  if (!data.products || data.products.length === 0) throw new Error('Product not found for this barcode')
  return formatProduct(data.products[0])
}, { method: 'lookup_barcode' })

const searchProducts = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const data = await barcodeFetch<{ products: Array<Record<string, unknown>> }>(\`/products?search=\${encodeURIComponent(query)}\`)
  return { query, count: data.products?.length || 0, products: (data.products || []).slice(0, 10).map(formatProduct) }
}, { method: 'search_products' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { lookupBarcode, searchProducts }

console.log('settlegrid-barcode-lookup MCP server ready')
console.log('Methods: lookup_barcode, search_products')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 276. settlegrid-open-corporates ──────────────────────────────────────────

generateServer({
  slug: 'open-corporates',
  name: 'OpenCorporates',
  description: 'Search the world\'s largest open database of company records via OpenCorporates.',
  keywords: ['business', 'companies', 'corporate', 'registry', 'filings'],
  upstream: { provider: 'OpenCorporates', baseUrl: 'https://api.opencorporates.com/v0.4', auth: 'None required (free tier)', rateLimit: '500 requests/month free', docsUrl: 'https://api.opencorporates.com/documentation' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_companies', displayName: 'Search Companies', costCents: 1, description: 'Search companies by name', params: [{ name: 'query', type: 'string', required: true, description: 'Company name to search' }, { name: 'jurisdiction', type: 'string', required: false, description: 'Jurisdiction code (e.g. "us_ca", "gb")' }] },
    { name: 'get_company', displayName: 'Get Company', costCents: 1, description: 'Get company details by jurisdiction and company number', params: [{ name: 'jurisdiction', type: 'string', required: true, description: 'Jurisdiction code (e.g. "us_ca", "gb")' }, { name: 'company_number', type: 'string', required: true, description: 'Company registration number' }] },
  ],
  serverTs: `/**
 * settlegrid-open-corporates — OpenCorporates MCP Server
 *
 * Wraps the OpenCorporates API for company records with SettleGrid billing.
 * No API key needed for basic access.
 *
 * Methods:
 *   search_companies(query, jurisdiction?)           — Search companies  (1¢)
 *   get_company(jurisdiction, company_number)        — Company details   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; jurisdiction?: string }
interface GetCompanyInput { jurisdiction: string; company_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.opencorporates.com/v0.4'

async function ocFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    if (res.status === 429) throw new Error('Rate limit exceeded')
    const body = await res.text().catch(() => '')
    throw new Error(\`OpenCorporates API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatCompany(c: Record<string, unknown>) {
  return {
    name: c.name,
    companyNumber: c.company_number,
    jurisdiction: c.jurisdiction_code,
    status: c.current_status || null,
    type: c.company_type || null,
    incorporationDate: c.incorporation_date || null,
    dissolutionDate: c.dissolution_date || null,
    registeredAddress: c.registered_address_in_full || null,
    opencorporatesUrl: c.opencorporates_url,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'open-corporates',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search Companies' },
      get_company: { costCents: 1, displayName: 'Get Company' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  let url = \`/companies/search?q=\${encodeURIComponent(query)}\`
  if (args.jurisdiction && typeof args.jurisdiction === 'string') {
    url += \`&jurisdiction_code=\${encodeURIComponent(args.jurisdiction.trim().toLowerCase())}\`
  }
  const data = await ocFetch<{ results: { companies: Array<{ company: Record<string, unknown> }> ; total_count: number } }>(url)
  return {
    query, jurisdiction: args.jurisdiction || null,
    totalCount: data.results.total_count,
    companies: data.results.companies.slice(0, 15).map(c => formatCompany(c.company)),
  }
}, { method: 'search_companies' })

const getCompany = sg.wrap(async (args: GetCompanyInput) => {
  if (!args.jurisdiction || typeof args.jurisdiction !== 'string') throw new Error('jurisdiction is required')
  if (!args.company_number || typeof args.company_number !== 'string') throw new Error('company_number is required')
  const jur = args.jurisdiction.trim().toLowerCase()
  const num = args.company_number.trim()
  const data = await ocFetch<{ results: { company: Record<string, unknown> } }>(\`/companies/\${encodeURIComponent(jur)}/\${encodeURIComponent(num)}\`)
  return formatCompany(data.results.company)
}, { method: 'get_company' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getCompany }

console.log('settlegrid-open-corporates MCP server ready')
console.log('Methods: search_companies, get_company')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 277. settlegrid-sec-companies ────────────────────────────────────────────

generateServer({
  slug: 'sec-companies',
  name: 'SEC Company Filings',
  description: 'Search SEC EDGAR for company filings, CIK lookups, and filing data.',
  keywords: ['business', 'sec', 'edgar', 'filings', 'stocks', 'finance'],
  upstream: { provider: 'SEC EDGAR', baseUrl: 'https://efts.sec.gov/LATEST', auth: 'None required', rateLimit: '10 requests/second', docsUrl: 'https://www.sec.gov/search' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_companies', displayName: 'Search Companies', costCents: 1, description: 'Search SEC EDGAR for companies', params: [{ name: 'query', type: 'string', required: true, description: 'Company name or ticker symbol' }] },
    { name: 'get_filings', displayName: 'Get Filings', costCents: 1, description: 'Get recent filings for a company by CIK', params: [{ name: 'cik', type: 'string', required: true, description: 'SEC CIK number (e.g. "0000320193" for Apple)' }, { name: 'form_type', type: 'string', required: false, description: 'Filing type filter (e.g. "10-K", "10-Q", "8-K")' }] },
  ],
  serverTs: `/**
 * settlegrid-sec-companies — SEC EDGAR MCP Server
 *
 * Wraps the SEC EDGAR full-text search API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_companies(query)             — Search SEC EDGAR         (1¢)
 *   get_filings(cik, form_type?)       — Get company filings       (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface FilingsInput { cik: string; form_type?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const SEARCH_BASE = 'https://efts.sec.gov/LATEST'
const EDGAR_BASE = 'https://data.sec.gov'
const USER_AGENT = 'settlegrid-sec/1.0 (contact@settlegrid.ai)'

async function secFetch<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`SEC API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function padCik(cik: string): string {
  return cik.replace(/^0+/, '').padStart(10, '0')
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'sec-companies',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_companies: { costCents: 1, displayName: 'Search Companies' },
      get_filings: { costCents: 1, displayName: 'Get Filings' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchCompanies = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await secFetch<{ hits: { hits: Array<{ _source: { entity_name: string; tickers: string[]; ciks: string[]; entity_id: string } }> ; total: { value: number } } }>(\`\${SEARCH_BASE}/search-index?q=\${encodeURIComponent(query)}&dateRange=custom&startdt=2020-01-01&enddt=2026-12-31\`)
  const seen = new Set<string>()
  const companies = data.hits.hits
    .filter(h => { const id = h._source.entity_id; if (seen.has(id)) return false; seen.add(id); return true })
    .slice(0, 15)
    .map(h => ({ name: h._source.entity_name, tickers: h._source.tickers || [], cik: h._source.ciks?.[0] || null }))
  return { query, totalHits: data.hits.total.value, companies }
}, { method: 'search_companies' })

const getFilings = sg.wrap(async (args: FilingsInput) => {
  if (!args.cik || typeof args.cik !== 'string') throw new Error('cik is required')
  const cik = padCik(args.cik.trim())
  if (!/^\\d{10}$/.test(cik)) throw new Error('Invalid CIK format')
  const data = await secFetch<{ filings: { recent: { form: string[]; filingDate: string[]; primaryDocument: string[]; accessionNumber: string[]; primaryDocDescription: string[] } }; name: string; tickers: string[] }>(\`\${EDGAR_BASE}/submissions/CIK\${cik}.json\`)
  const recent = data.filings.recent
  let indices = Array.from({ length: recent.form.length }, (_, i) => i)
  if (args.form_type && typeof args.form_type === 'string') {
    const ft = args.form_type.toUpperCase().trim()
    indices = indices.filter(i => recent.form[i] === ft)
  }
  return {
    name: data.name, cik, tickers: data.tickers || [],
    filings: indices.slice(0, 20).map(i => ({
      form: recent.form[i], filingDate: recent.filingDate[i],
      description: recent.primaryDocDescription[i] || null,
      document: recent.primaryDocument[i],
      accessionNumber: recent.accessionNumber[i],
    })),
  }
}, { method: 'get_filings' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchCompanies, getFilings }

console.log('settlegrid-sec-companies MCP server ready')
console.log('Methods: search_companies, get_filings')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 278. settlegrid-usda-markets ─────────────────────────────────────────────

generateServer({
  slug: 'usda-markets',
  name: 'USDA Farmers Markets',
  description: 'Search for farmers markets and local food sources across the United States via USDA.',
  keywords: ['business', 'usda', 'farmers-market', 'food', 'agriculture'],
  upstream: { provider: 'USDA', baseUrl: 'https://search.ams.usda.gov/farmersmarkets/v1/data.svc', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://search.ams.usda.gov/farmersmarkets/v1/svcdesc.html' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_markets', displayName: 'Search Markets', costCents: 1, description: 'Search farmers markets by zip code', params: [{ name: 'zip', type: 'string', required: true, description: 'US zip code (e.g. "90210")' }] },
    { name: 'get_market', displayName: 'Get Market Details', costCents: 1, description: 'Get details for a specific farmers market', params: [{ name: 'id', type: 'string', required: true, description: 'Market ID from search results' }] },
  ],
  serverTs: `/**
 * settlegrid-usda-markets — USDA Farmers Markets MCP Server
 *
 * Wraps the USDA Farmers Markets API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_markets(zip)    — Search markets by zip code   (1¢)
 *   get_market(id)         — Market details by ID         (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { zip: string }
interface GetMarketInput { id: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://search.ams.usda.gov/farmersmarkets/v1/data.svc'
const ZIP_RE = /^\\d{5}$/

async function usdaFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`USDA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'usda-markets',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_markets: { costCents: 1, displayName: 'Search Markets' },
      get_market: { costCents: 1, displayName: 'Get Market Details' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchMarkets = sg.wrap(async (args: SearchInput) => {
  if (!args.zip || typeof args.zip !== 'string') throw new Error('zip is required')
  const zip = args.zip.trim()
  if (!ZIP_RE.test(zip)) throw new Error('zip must be a 5-digit US zip code')
  const data = await usdaFetch<{ results: Array<{ id: string; marketname: string }> }>(\`/zipSearch?zip=\${zip}\`)
  return {
    zip,
    count: data.results.length,
    markets: data.results.slice(0, 20).map(m => {
      const parts = m.marketname.split(' ')
      const distance = parts[0]
      const name = parts.slice(1).join(' ')
      return { id: m.id, name, distance }
    }),
  }
}, { method: 'search_markets' })

const getMarket = sg.wrap(async (args: GetMarketInput) => {
  if (!args.id || typeof args.id !== 'string') throw new Error('id is required')
  const id = args.id.trim()
  if (!/^\\d+$/.test(id)) throw new Error('id must be a numeric market ID')
  const data = await usdaFetch<{ marketdetails: { Address: string; GoogleLink: string; Products: string; Schedule: string } }>(\`/mktDetail?id=\${id}\`)
  const d = data.marketdetails
  return {
    id,
    address: d.Address || null,
    googleMapsLink: d.GoogleLink || null,
    products: d.Products ? d.Products.split(';').map((p: string) => p.trim()).filter(Boolean) : [],
    schedule: d.Schedule || null,
  }
}, { method: 'get_market' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchMarkets, getMarket }

console.log('settlegrid-usda-markets MCP server ready')
console.log('Methods: search_markets, get_market')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 279. settlegrid-fda-recalls ──────────────────────────────────────────────

generateServer({
  slug: 'fda-recalls',
  name: 'FDA Recalls',
  description: 'Search FDA food, drug, and device recalls and enforcement actions via openFDA.',
  keywords: ['business', 'fda', 'recalls', 'food-safety', 'health'],
  upstream: { provider: 'openFDA', baseUrl: 'https://api.fda.gov', auth: 'None required', rateLimit: '240 requests/minute', docsUrl: 'https://open.fda.gov/apis/' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_food_recalls', displayName: 'Food Recalls', costCents: 1, description: 'Search FDA food recall enforcement actions', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (product name, company, reason)' }, { name: 'limit', type: 'number', required: false, description: 'Max results 1-100 (default 10)' }] },
    { name: 'search_drug_recalls', displayName: 'Drug Recalls', costCents: 1, description: 'Search FDA drug recall enforcement actions', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results 1-100 (default 10)' }] },
    { name: 'search_device_recalls', displayName: 'Device Recalls', costCents: 1, description: 'Search FDA medical device recall enforcement actions', params: [{ name: 'query', type: 'string', required: true, description: 'Search query' }, { name: 'limit', type: 'number', required: false, description: 'Max results 1-100 (default 10)' }] },
  ],
  serverTs: `/**
 * settlegrid-fda-recalls — FDA Recalls MCP Server
 *
 * Wraps the openFDA API for recall data with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_food_recalls(query, limit?)    — Food recalls     (1¢)
 *   search_drug_recalls(query, limit?)    — Drug recalls     (1¢)
 *   search_device_recalls(query, limit?)  — Device recalls   (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface RecallInput { query: string; limit?: number }

interface RecallEntry {
  recall_number: string
  reason_for_recall: string
  status: string
  classification: string
  product_description: string
  recalling_firm: string
  city: string
  state: string
  country: string
  recall_initiation_date: string
  voluntary_mandated: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.fda.gov'

async function fdaFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('No results found')
    const body = await res.text().catch(() => '')
    throw new Error(\`openFDA API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function formatRecall(r: RecallEntry) {
  return {
    recallNumber: r.recall_number,
    reason: r.reason_for_recall?.slice(0, 500),
    status: r.status,
    classification: r.classification,
    product: r.product_description?.slice(0, 300),
    firm: r.recalling_firm,
    location: [r.city, r.state, r.country].filter(Boolean).join(', '),
    initiationDate: r.recall_initiation_date,
    voluntaryMandated: r.voluntary_mandated,
  }
}

function buildRecallSearch(category: string, query: string, limit: number) {
  const safeQuery = query.replace(/[^a-zA-Z0-9 ]/g, '').trim()
  const lim = Math.min(Math.max(limit, 1), 100)
  return \`/\${category}/enforcement.json?search=\${encodeURIComponent(safeQuery)}&limit=\${lim}\`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fda-recalls',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_food_recalls: { costCents: 1, displayName: 'Food Recalls' },
      search_drug_recalls: { costCents: 1, displayName: 'Drug Recalls' },
      search_device_recalls: { costCents: 1, displayName: 'Device Recalls' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchFoodRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('food', args.query, args.limit || 10))
  return { query: args.query, category: 'food', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_food_recalls' })

const searchDrugRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('drug', args.query, args.limit || 10))
  return { query: args.query, category: 'drug', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_drug_recalls' })

const searchDeviceRecalls = sg.wrap(async (args: RecallInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const data = await fdaFetch<{ meta: { results: { total: number } }; results: RecallEntry[] }>(buildRecallSearch('device', args.query, args.limit || 10))
  return { query: args.query, category: 'device', total: data.meta.results.total, recalls: data.results.map(formatRecall) }
}, { method: 'search_device_recalls' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchFoodRecalls, searchDrugRecalls, searchDeviceRecalls }

console.log('settlegrid-fda-recalls MCP server ready')
console.log('Methods: search_food_recalls, search_drug_recalls, search_device_recalls')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 280. settlegrid-patent-search ────────────────────────────────────────────

generateServer({
  slug: 'patent-search',
  name: 'USPTO Patent Search',
  description: 'Search US patents and patent applications via the USPTO Patent API.',
  keywords: ['business', 'patents', 'uspto', 'intellectual-property', 'inventions'],
  upstream: { provider: 'USPTO', baseUrl: 'https://developer.uspto.gov/ibd-api/v1', auth: 'None required', rateLimit: 'See USPTO terms', docsUrl: 'https://developer.uspto.gov/api-catalog' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_patents', displayName: 'Search Patents', costCents: 1, description: 'Search US patents by keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Search query (keywords, inventor, assignee)' }, { name: 'rows', type: 'number', required: false, description: 'Results per page 1-50 (default 10)' }] },
    { name: 'get_patent', displayName: 'Get Patent', costCents: 1, description: 'Get patent details by patent number', params: [{ name: 'patent_number', type: 'string', required: true, description: 'US patent number (e.g. "11234567")' }] },
  ],
  serverTs: `/**
 * settlegrid-patent-search — USPTO Patent Search MCP Server
 *
 * Wraps the USPTO Patent API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_patents(query, rows?)         — Search US patents   (1¢)
 *   get_patent(patent_number)            — Patent details      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; rows?: number }
interface GetPatentInput { patent_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://developer.uspto.gov/ibd-api/v1'
const USER_AGENT = 'settlegrid-patent-search/1.0 (contact@settlegrid.ai)'

async function usptoFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Patent not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`USPTO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'patent-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_patents: { costCents: 1, displayName: 'Search Patents' },
      get_patent: { costCents: 1, displayName: 'Get Patent' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchPatents = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await usptoFetch<{ response: { numFound: number; docs: Array<Record<string, unknown>> } }>(\`/application/publications?searchText=\${encodeURIComponent(query)}&rows=\${rows}\`)
  return {
    query,
    totalFound: data.response.numFound,
    patents: data.response.docs.slice(0, rows).map(d => ({
      patentNumber: d.patentNumber || d.publicationReferenceDocumentNumber,
      title: d.inventionTitle,
      abstract: ((d.abstractText as string[]) || []).join(' ').slice(0, 500),
      inventors: d.inventorNameArrayText || [],
      assignee: d.assigneeEntityName || null,
      filingDate: d.filingDate || null,
      publicationDate: d.publicationDate || null,
    })),
  }
}, { method: 'search_patents' })

const getPatent = sg.wrap(async (args: GetPatentInput) => {
  if (!args.patent_number || typeof args.patent_number !== 'string') throw new Error('patent_number is required')
  const num = args.patent_number.trim().replace(/[^0-9]/g, '')
  if (num.length < 6 || num.length > 11) throw new Error('patent_number must be 6-11 digits')
  const data = await usptoFetch<{ response: { docs: Array<Record<string, unknown>> } }>(\`/application/publications?patentNumber=\${num}\`)
  if (!data.response.docs || data.response.docs.length === 0) throw new Error('Patent not found')
  const d = data.response.docs[0]
  return {
    patentNumber: d.patentNumber || num,
    title: d.inventionTitle,
    abstract: ((d.abstractText as string[]) || []).join(' '),
    inventors: d.inventorNameArrayText || [],
    assignee: d.assigneeEntityName || null,
    filingDate: d.filingDate || null,
    publicationDate: d.publicationDate || null,
    claims: ((d.claimText as string[]) || []).slice(0, 5),
  }
}, { method: 'get_patent' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchPatents, getPatent }

console.log('settlegrid-patent-search MCP server ready')
console.log('Methods: search_patents, get_patent')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 281. settlegrid-trademark-search ─────────────────────────────────────────

generateServer({
  slug: 'trademark-search',
  name: 'USPTO Trademark Search',
  description: 'Search US trademarks and service marks via the USPTO Trademark API.',
  keywords: ['business', 'trademarks', 'uspto', 'intellectual-property', 'brands'],
  upstream: { provider: 'USPTO', baseUrl: 'https://developer.uspto.gov/ds-api', auth: 'None required', rateLimit: 'See USPTO terms', docsUrl: 'https://developer.uspto.gov/api-catalog' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_trademarks', displayName: 'Search Trademarks', costCents: 1, description: 'Search US trademarks by name or keyword', params: [{ name: 'query', type: 'string', required: true, description: 'Trademark name or keyword' }, { name: 'rows', type: 'number', required: false, description: 'Results per page 1-50 (default 10)' }] },
    { name: 'get_trademark_status', displayName: 'Trademark Status', costCents: 1, description: 'Get trademark registration status by serial number', params: [{ name: 'serial_number', type: 'string', required: true, description: 'Trademark serial number (e.g. "87654321")' }] },
  ],
  serverTs: `/**
 * settlegrid-trademark-search — USPTO Trademark MCP Server
 *
 * Wraps the USPTO Trademark API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_trademarks(query, rows?)        — Search trademarks   (1¢)
 *   get_trademark_status(serial_number)    — Trademark status     (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string; rows?: number }
interface StatusInput { serial_number: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://developer.uspto.gov/ds-api'
const USER_AGENT = 'settlegrid-trademark-search/1.0 (contact@settlegrid.ai)'

async function usptoFetch<T>(path: string): Promise<T> {
  const res = await fetch(\`\${API_BASE}\${path}\`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) {
    if (res.status === 404) throw new Error('Not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`USPTO API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'trademark-search',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_trademarks: { costCents: 1, displayName: 'Search Trademarks' },
      get_trademark_status: { costCents: 1, displayName: 'Trademark Status' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchTrademarks = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const rows = Math.min(Math.max(args.rows || 10, 1), 50)
  const data = await usptoFetch<{ response: { numFound: number; docs: Array<Record<string, unknown>> } }>(\`/oa_citations/v2/citations?searchText=\${encodeURIComponent(query)}&rows=\${rows}\`)
  return {
    query,
    totalFound: data.response?.numFound || 0,
    trademarks: (data.response?.docs || []).slice(0, rows).map(d => ({
      serialNumber: d.serialNumber || d.applicationNumberText,
      markText: d.markCurrentStatusExternalDescriptionText || d.markIdentification || d.citedMarkOwnerName,
      status: d.markCurrentStatusExternalDescriptionText || null,
      filingDate: d.applicationDate || d.filingDate || null,
      registrationNumber: d.registrationNumber || null,
      owner: d.citedMarkOwnerName || d.ownerName || null,
    })),
  }
}, { method: 'search_trademarks' })

const getTrademarkStatus = sg.wrap(async (args: StatusInput) => {
  if (!args.serial_number || typeof args.serial_number !== 'string') throw new Error('serial_number is required')
  const sn = args.serial_number.trim().replace(/[^0-9]/g, '')
  if (sn.length < 7 || sn.length > 8) throw new Error('serial_number must be 7-8 digits')
  const data = await usptoFetch<{ response: { docs: Array<Record<string, unknown>> } }>(\`/oa_citations/v2/citations?searchText=\${sn}&rows=1\`)
  if (!data.response?.docs?.length) throw new Error('Trademark not found')
  const d = data.response.docs[0]
  return {
    serialNumber: sn,
    markText: d.markIdentification || d.citedMarkOwnerName || null,
    status: d.markCurrentStatusExternalDescriptionText || null,
    filingDate: d.applicationDate || null,
    registrationNumber: d.registrationNumber || null,
    owner: d.citedMarkOwnerName || d.ownerName || null,
    internationalClass: d.internationalClassDescriptionText || null,
  }
}, { method: 'get_trademark_status' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchTrademarks, getTrademarkStatus }

console.log('settlegrid-trademark-search MCP server ready')
console.log('Methods: search_trademarks, get_trademark_status')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 282. settlegrid-glassdoor (Trustpilot alternative) ───────────────────────

generateServer({
  slug: 'glassdoor',
  name: 'Trustpilot Reviews',
  description: 'Search business reviews and ratings via the Trustpilot public API (Glassdoor has no public API).',
  keywords: ['business', 'reviews', 'ratings', 'trustpilot', 'company-reviews'],
  upstream: { provider: 'Trustpilot', baseUrl: 'https://api.trustpilot.com/v1', auth: 'API key required (query param)', rateLimit: 'Free tier available', docsUrl: 'https://documentation-apidocumentation.trustpilot.com/' },
  auth: { type: 'query', keyEnvVar: 'TRUSTPILOT_API_KEY', keyDesc: 'Trustpilot API key' },
  methods: [
    { name: 'search_businesses', displayName: 'Search Businesses', costCents: 2, description: 'Search businesses on Trustpilot by name', params: [{ name: 'query', type: 'string', required: true, description: 'Business name to search' }] },
    { name: 'get_reviews', displayName: 'Get Reviews', costCents: 2, description: 'Get reviews for a business by domain', params: [{ name: 'domain', type: 'string', required: true, description: 'Business domain (e.g. "stripe.com")' }] },
  ],
  serverTs: `/**
 * settlegrid-glassdoor — Trustpilot Reviews MCP Server
 *
 * Wraps the Trustpilot API for business reviews with SettleGrid billing.
 * Glassdoor has no public API; Trustpilot is used as the review source.
 * Requires a Trustpilot API key.
 *
 * Methods:
 *   search_businesses(query)    — Search businesses       (2¢)
 *   get_reviews(domain)         — Get business reviews    (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query: string }
interface ReviewsInput { domain: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.trustpilot.com/v1'
const API_KEY = process.env.TRUSTPILOT_API_KEY || ''
const DOMAIN_RE = /^[a-zA-Z0-9][a-zA-Z0-9-]*\\.[a-zA-Z]{2,}$/

async function tpFetch<T>(path: string): Promise<T> {
  if (!API_KEY) throw new Error('TRUSTPILOT_API_KEY environment variable is required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${API_BASE}\${path}\${separator}apikey=\${API_KEY}\`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Trustpilot API key')
    if (res.status === 404) throw new Error('Business not found')
    const body = await res.text().catch(() => '')
    throw new Error(\`Trustpilot API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'glassdoor',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_businesses: { costCents: 2, displayName: 'Search Businesses' },
      get_reviews: { costCents: 2, displayName: 'Get Reviews' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchBusinesses = sg.wrap(async (args: SearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 100) throw new Error('query must be 1-100 characters')
  const data = await tpFetch<{ businessUnits: Array<{ displayName: string; trustScore: number; numberOfReviews: { total: number }; websiteUrl: string; identifyingName: string }> }>(\`/business-units/search?query=\${encodeURIComponent(query)}\`)
  return {
    query,
    count: data.businessUnits?.length || 0,
    businesses: (data.businessUnits || []).slice(0, 15).map(b => ({
      name: b.displayName, trustScore: b.trustScore, totalReviews: b.numberOfReviews?.total || 0,
      website: b.websiteUrl || null, slug: b.identifyingName,
    })),
  }
}, { method: 'search_businesses' })

const getReviews = sg.wrap(async (args: ReviewsInput) => {
  if (!args.domain || typeof args.domain !== 'string') throw new Error('domain is required')
  const domain = args.domain.trim().toLowerCase()
  if (!DOMAIN_RE.test(domain)) throw new Error('Invalid domain format')
  // First find the business unit
  const searchData = await tpFetch<{ businessUnits: Array<{ id: string; displayName: string; trustScore: number; numberOfReviews: { total: number } }> }>(\`/business-units/search?query=\${encodeURIComponent(domain)}\`)
  if (!searchData.businessUnits?.length) throw new Error('Business not found for this domain')
  const bu = searchData.businessUnits[0]
  // Then get reviews
  const reviews = await tpFetch<{ reviews: Array<{ title: string; text: string; stars: number; createdAt: string; consumer: { displayName: string } }> }>(\`/business-units/\${bu.id}/reviews?perPage=10\`)
  return {
    domain, name: bu.displayName, trustScore: bu.trustScore, totalReviews: bu.numberOfReviews?.total || 0,
    reviews: (reviews.reviews || []).map(r => ({
      title: r.title, text: r.text?.slice(0, 300), stars: r.stars,
      date: r.createdAt, author: r.consumer?.displayName || 'Anonymous',
    })),
  }
}, { method: 'get_reviews' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchBusinesses, getReviews }

console.log('settlegrid-glassdoor MCP server ready')
console.log('Methods: search_businesses, get_reviews')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 283. settlegrid-indeed (Adzuna) ──────────────────────────────────────────

generateServer({
  slug: 'indeed',
  name: 'Adzuna Job Search',
  description: 'Search job listings across multiple countries via the Adzuna API (Indeed alternative).',
  keywords: ['business', 'jobs', 'employment', 'hiring', 'adzuna'],
  upstream: { provider: 'Adzuna', baseUrl: 'https://api.adzuna.com/v1/api/jobs', auth: 'API key required (query param)', rateLimit: 'Free tier: 250/month', docsUrl: 'https://developer.adzuna.com/' },
  auth: { type: 'query', keyEnvVar: 'ADZUNA_APP_ID', keyDesc: 'Adzuna App ID + API Key (set both ADZUNA_APP_ID and ADZUNA_API_KEY)' },
  methods: [
    { name: 'search_jobs', displayName: 'Search Jobs', costCents: 2, description: 'Search job listings by keyword and location', params: [{ name: 'query', type: 'string', required: true, description: 'Job title or keyword' }, { name: 'location', type: 'string', required: false, description: 'Location (city, state, or country)' }, { name: 'country', type: 'string', required: false, description: 'Country code: us, gb, au, ca, de, fr, in, nl, nz, pl, za (default: us)' }] },
    { name: 'get_salary', displayName: 'Get Salary Data', costCents: 2, description: 'Get salary estimates for a job title and location', params: [{ name: 'query', type: 'string', required: true, description: 'Job title' }, { name: 'location', type: 'string', required: false, description: 'Location for salary data' }, { name: 'country', type: 'string', required: false, description: 'Country code (default: us)' }] },
  ],
  serverTs: `/**
 * settlegrid-indeed — Adzuna Job Search MCP Server
 *
 * Wraps the Adzuna API for job listings (Indeed alternative) with SettleGrid billing.
 * Requires Adzuna App ID and API key.
 *
 * Methods:
 *   search_jobs(query, location?, country?)    — Search jobs        (2¢)
 *   get_salary(query, location?, country?)     — Salary estimates   (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface JobSearchInput { query: string; location?: string; country?: string }
interface SalaryInput { query: string; location?: string; country?: string }

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://api.adzuna.com/v1/api/jobs'
const APP_ID = process.env.ADZUNA_APP_ID || ''
const API_KEY = process.env.ADZUNA_API_KEY || ''
const VALID_COUNTRIES = new Set(['us', 'gb', 'au', 'ca', 'de', 'fr', 'in', 'nl', 'nz', 'pl', 'za'])

async function adzunaFetch<T>(path: string): Promise<T> {
  if (!APP_ID || !API_KEY) throw new Error('ADZUNA_APP_ID and ADZUNA_API_KEY environment variables are required')
  const separator = path.includes('?') ? '&' : '?'
  const res = await fetch(\`\${path}\${separator}app_id=\${APP_ID}&app_key=\${API_KEY}\`)
  if (!res.ok) {
    if (res.status === 401) throw new Error('Invalid Adzuna credentials')
    const body = await res.text().catch(() => '')
    throw new Error(\`Adzuna API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<T>
}

function getCountry(c?: string): string {
  const code = (c || 'us').toLowerCase().trim()
  if (!VALID_COUNTRIES.has(code)) throw new Error(\`country must be one of: \${[...VALID_COUNTRIES].join(', ')}\`)
  return code
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'indeed',
  pricing: {
    defaultCostCents: 2,
    methods: {
      search_jobs: { costCents: 2, displayName: 'Search Jobs' },
      get_salary: { costCents: 2, displayName: 'Get Salary Data' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchJobs = sg.wrap(async (args: JobSearchInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  if (query.length === 0 || query.length > 200) throw new Error('query must be 1-200 characters')
  const country = getCountry(args.country)
  let url = \`\${API_BASE}/\${country}/search/1?what=\${encodeURIComponent(query)}&results_per_page=15\`
  if (args.location) url += \`&where=\${encodeURIComponent(args.location.trim())}\`
  const data = await adzunaFetch<{ count: number; results: Array<{ title: string; description: string; redirect_url: string; salary_min: number; salary_max: number; company: { display_name: string }; location: { display_name: string }; created: string; category: { label: string } }> }>(url)
  return {
    query, country, location: args.location || null, totalCount: data.count,
    jobs: (data.results || []).map(j => ({
      title: j.title, description: j.description?.slice(0, 300), url: j.redirect_url,
      salaryMin: j.salary_min || null, salaryMax: j.salary_max || null,
      company: j.company?.display_name || null, location: j.location?.display_name || null,
      posted: j.created, category: j.category?.label || null,
    })),
  }
}, { method: 'search_jobs' })

const getSalary = sg.wrap(async (args: SalaryInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const query = args.query.trim()
  const country = getCountry(args.country)
  let url = \`\${API_BASE}/\${country}/history?what=\${encodeURIComponent(query)}&months=12\`
  if (args.location) url += \`&where=\${encodeURIComponent(args.location.trim())}\`
  const data = await adzunaFetch<{ month: Record<string, number> }>(url)
  const months = Object.entries(data.month || {}).sort(([a], [b]) => a.localeCompare(b))
  const salaries = months.map(([month, salary]) => ({ month, averageSalary: Math.round(salary) }))
  const avg = salaries.length > 0 ? Math.round(salaries.reduce((s, m) => s + m.averageSalary, 0) / salaries.length) : null
  return { query, country, location: args.location || null, averageSalary: avg, history: salaries }
}, { method: 'get_salary' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchJobs, getSalary }

console.log('settlegrid-indeed MCP server ready')
console.log('Methods: search_jobs, get_salary')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
`,
})

// ─── 284. settlegrid-remoteok ─────────────────────────────────────────────────

generateServer({
  slug: 'remoteok',
  name: 'RemoteOK Jobs',
  description: 'Search remote job listings worldwide via the RemoteOK API.',
  keywords: ['business', 'jobs', 'remote', 'remote-work', 'hiring'],
  upstream: { provider: 'RemoteOK', baseUrl: 'https://remoteok.com/api', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://remoteok.com/api' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_remote_jobs', displayName: 'Search Remote Jobs', costCents: 1, description: 'Search remote job listings by keyword', params: [{ name: 'query', type: 'string', required: false, description: 'Job title or skill keyword' }, { name: 'tags', type: 'string', required: false, description: 'Comma-separated tags (e.g. "javascript,react")' }] },
    { name: 'get_latest_jobs', displayName: 'Latest Remote Jobs', costCents: 1, description: 'Get the most recently posted remote jobs', params: [] },
  ],
  serverTs: `/**
 * settlegrid-remoteok — RemoteOK Jobs MCP Server
 *
 * Wraps the RemoteOK API for remote job listings with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   search_remote_jobs(query?, tags?)   — Search remote jobs    (1¢)
 *   get_latest_jobs()                   — Latest remote jobs    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; tags?: string }

interface RemoteJob {
  id: string
  slug: string
  company: string
  position: string
  tags: string[]
  description: string
  location: string
  salary_min: number
  salary_max: number
  date: string
  url: string
  company_logo: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://remoteok.com/api'

async function remoteokFetch(): Promise<RemoteJob[]> {
  const res = await fetch(API_BASE, {
    headers: { 'User-Agent': 'settlegrid-remoteok/1.0 (contact@settlegrid.ai)' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`RemoteOK API \${res.status}: \${body.slice(0, 200)}\`)
  }
  const data = await res.json() as unknown[]
  // First element is a legal notice, skip it
  return data.filter((item): item is RemoteJob => typeof item === 'object' && item !== null && 'position' in item)
}

function formatJob(j: RemoteJob) {
  return {
    id: j.id,
    position: j.position,
    company: j.company,
    tags: j.tags || [],
    location: j.location || 'Worldwide',
    salaryMin: j.salary_min || null,
    salaryMax: j.salary_max || null,
    date: j.date,
    url: j.url || \`https://remoteok.com/l/\${j.slug}\`,
    companyLogo: j.company_logo || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'remoteok',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_remote_jobs: { costCents: 1, displayName: 'Search Remote Jobs' },
      get_latest_jobs: { costCents: 1, displayName: 'Latest Remote Jobs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchRemoteJobs = sg.wrap(async (args: SearchInput) => {
  const allJobs = await remoteokFetch()
  let filtered = allJobs

  if (args.query && typeof args.query === 'string') {
    const q = args.query.toLowerCase().trim()
    filtered = filtered.filter(j =>
      j.position.toLowerCase().includes(q) ||
      j.company.toLowerCase().includes(q) ||
      (j.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }

  if (args.tags && typeof args.tags === 'string') {
    const tags = args.tags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
    filtered = filtered.filter(j =>
      tags.some(tag => (j.tags || []).some(t => t.toLowerCase().includes(tag)))
    )
  }

  return { query: args.query || null, tags: args.tags || null, count: filtered.length, jobs: filtered.slice(0, 20).map(formatJob) }
}, { method: 'search_remote_jobs' })

const getLatestJobs = sg.wrap(async () => {
  const allJobs = await remoteokFetch()
  return { count: allJobs.length, jobs: allJobs.slice(0, 20).map(formatJob) }
}, { method: 'get_latest_jobs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchRemoteJobs, getLatestJobs }

console.log('settlegrid-remoteok MCP server ready')
console.log('Methods: search_remote_jobs, get_latest_jobs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

// ─── 285. settlegrid-github-jobs (Arbeitnow) ─────────────────────────────────

generateServer({
  slug: 'github-jobs',
  name: 'Arbeitnow Developer Jobs',
  description: 'Search developer and tech job listings via the Arbeitnow API (GitHub Jobs deprecated, uses Arbeitnow).',
  keywords: ['business', 'jobs', 'developer', 'tech', 'hiring'],
  upstream: { provider: 'Arbeitnow', baseUrl: 'https://arbeitnow.com/api/job-board-api', auth: 'None required', rateLimit: 'No published limit', docsUrl: 'https://arbeitnow.com/api/job-board-api' },
  auth: { type: 'none' },
  methods: [
    { name: 'search_dev_jobs', displayName: 'Search Dev Jobs', costCents: 1, description: 'Search developer and tech job listings', params: [{ name: 'query', type: 'string', required: false, description: 'Job title or keyword filter' }, { name: 'remote', type: 'boolean', required: false, description: 'Filter remote-only jobs' }] },
    { name: 'get_latest_dev_jobs', displayName: 'Latest Dev Jobs', costCents: 1, description: 'Get most recently posted developer jobs', params: [{ name: 'page', type: 'number', required: false, description: 'Page number (default 1)' }] },
  ],
  serverTs: `/**
 * settlegrid-github-jobs — Arbeitnow Developer Jobs MCP Server
 *
 * GitHub Jobs API has been deprecated. This server uses Arbeitnow as an
 * alternative source for developer and tech job listings.
 * No API key needed.
 *
 * Methods:
 *   search_dev_jobs(query?, remote?)    — Search dev jobs      (1¢)
 *   get_latest_dev_jobs(page?)          — Latest dev jobs      (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface SearchInput { query?: string; remote?: boolean }
interface LatestInput { page?: number }

interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://arbeitnow.com/api/job-board-api'

async function arbeitnowFetch(page: number): Promise<{ data: ArbeitnowJob[]; meta: { currentPage: number; lastPage: number } }> {
  const res = await fetch(\`\${API_BASE}?page=\${page}\`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(\`Arbeitnow API \${res.status}: \${body.slice(0, 200)}\`)
  }
  return res.json() as Promise<{ data: ArbeitnowJob[]; meta: { currentPage: number; lastPage: number } }>
}

function formatJob(j: ArbeitnowJob) {
  return {
    slug: j.slug,
    title: j.title,
    company: j.company_name,
    location: j.location || 'Not specified',
    remote: j.remote,
    tags: j.tags || [],
    jobTypes: j.job_types || [],
    url: j.url,
    description: (j.description || '').replace(/<[^>]*>/g, '').slice(0, 400),
    postedAt: j.created_at ? new Date(j.created_at * 1000).toISOString() : null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'github-jobs',
  pricing: {
    defaultCostCents: 1,
    methods: {
      search_dev_jobs: { costCents: 1, displayName: 'Search Dev Jobs' },
      get_latest_dev_jobs: { costCents: 1, displayName: 'Latest Dev Jobs' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const searchDevJobs = sg.wrap(async (args: SearchInput) => {
  const data = await arbeitnowFetch(1)
  let filtered = data.data

  if (args.query && typeof args.query === 'string') {
    const q = args.query.toLowerCase().trim()
    filtered = filtered.filter(j =>
      j.title.toLowerCase().includes(q) ||
      j.company_name.toLowerCase().includes(q) ||
      (j.tags || []).some(t => t.toLowerCase().includes(q))
    )
  }

  if (args.remote === true) {
    filtered = filtered.filter(j => j.remote)
  }

  return { query: args.query || null, remote: args.remote || false, count: filtered.length, jobs: filtered.slice(0, 20).map(formatJob) }
}, { method: 'search_dev_jobs' })

const getLatestDevJobs = sg.wrap(async (args: LatestInput) => {
  const page = Math.min(Math.max(args.page || 1, 1), 50)
  const data = await arbeitnowFetch(page)
  return {
    page: data.meta.currentPage,
    lastPage: data.meta.lastPage,
    count: data.data.length,
    jobs: data.data.slice(0, 20).map(formatJob),
  }
}, { method: 'get_latest_dev_jobs' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { searchDevJobs, getLatestDevJobs }

console.log('settlegrid-github-jobs MCP server ready')
console.log('Methods: search_dev_jobs, get_latest_dev_jobs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
`,
})

console.log('\n=== Generation Complete ===')
console.log('Generated 30 MCP servers (15 Education + 15 Business/Commerce)')
