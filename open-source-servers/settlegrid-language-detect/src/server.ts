/**
 * settlegrid-language-detect — Language Detection MCP Server
 *
 * Wraps DetectLanguage API with SettleGrid billing.
 * Free key from https://detectlanguage.com/.
 *
 * Methods:
 *   detect_language(text) — detect language (2¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface DetectInput { text: string }

const API_BASE = 'https://ws.detectlanguage.com/0.2'
const API_KEY = process.env.DETECTLANGUAGE_API_KEY || ''

async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`
  const res = await fetch(url, {
    ...opts,
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

const sg = settlegrid.init({
  toolSlug: 'language-detect',
  pricing: {
    defaultCostCents: 2,
    methods: {
      detect_language: { costCents: 2, displayName: 'Detect Language' },
    },
  },
})

const detectLanguage = sg.wrap(async (args: DetectInput) => {
  if (!args.text) throw new Error('text is required')
  if (!API_KEY) throw new Error('DETECTLANGUAGE_API_KEY not set')
  const data = await apiFetch<any>('/detect', {
    method: 'POST',
    body: JSON.stringify({ q: args.text }),
  })
  return {
    text_preview: args.text.slice(0, 100),
    detections: (data.data?.detections || []).map((d: any) => ({
      language: d.language, confidence: d.confidence, is_reliable: d.isReliable,
    })),
  }
}, { method: 'detect_language' })

export { detectLanguage }

console.log('settlegrid-language-detect MCP server ready')
console.log('Methods: detect_language')
console.log('Pricing: 2¢ per call | Powered by SettleGrid')
