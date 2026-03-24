/**
 * settlegrid-ocr-space — OCR.space MCP Server
 *
 * Extract text from images and PDFs via OCR.space API.
 *
 * Methods:
 *   extract_text(url, language)   — Extract text from an image URL  (3¢)
 *   extract_from_pdf(url)         — Extract text from a PDF URL  (3¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface ExtractTextInput {
  url: string
  language?: string
}

interface ExtractFromPdfInput {
  url: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BASE = 'https://api.ocr.space'
const API_KEY = process.env.OCR_SPACE_API_KEY ?? ''

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'User-Agent': 'settlegrid-ocr-space/1.0' },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OCR.space API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'ocr-space',
  pricing: {
    defaultCostCents: 3,
    methods: {
      extract_text: { costCents: 3, displayName: 'Extract Text' },
      extract_from_pdf: { costCents: 3, displayName: 'Extract from PDF' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const extractText = sg.wrap(async (args: ExtractTextInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const language = typeof args.language === 'string' ? args.language.trim() : ''
  const data = await apiFetch<any>(`/parse/imageurl?url=${encodeURIComponent(url)}&language=${encodeURIComponent(language)}&OCREngine=2&apikey=${API_KEY}`)
  const items = (data.ParsedResults ?? []).slice(0, 1)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        ParsedText: item.ParsedText,
        ErrorMessage: item.ErrorMessage,
        FileParseExitCode: item.FileParseExitCode,
    })),
  }
}, { method: 'extract_text' })

const extractFromPdf = sg.wrap(async (args: ExtractFromPdfInput) => {
  if (!args.url || typeof args.url !== 'string') throw new Error('url is required')
  const url = args.url.trim()
  const data = await apiFetch<any>(`/parse/imageurl?url=${encodeURIComponent(url)}&isTable=true&OCREngine=2&apikey=${API_KEY}`)
  const items = (data.ParsedResults ?? []).slice(0, 5)
  return {
    count: items.length,
    results: items.map((item: any) => ({
        ParsedText: item.ParsedText,
        ErrorMessage: item.ErrorMessage,
        FileParseExitCode: item.FileParseExitCode,
    })),
  }
}, { method: 'extract_from_pdf' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { extractText, extractFromPdf }

console.log('settlegrid-ocr-space MCP server ready')
console.log('Methods: extract_text, extract_from_pdf')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')
