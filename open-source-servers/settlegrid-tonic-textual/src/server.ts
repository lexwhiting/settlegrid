/**
 * settlegrid-tonic-textual — Tonic Textual Redaction MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface RedactTextInput {
  text: string
  redactedFields?: string[]
}

const BASE = 'https://app.tonic.ai'

function getApiKey(): string {
  const k = process.env.TONIC_TEXTUAL_API_KEY
  if (!k) throw new Error('TONIC_TEXTUAL_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'tonic-textual',
  pricing: {
    defaultCostCents: 3,
    methods: {
      redact_text: { costCents: 3, displayName: 'Redact Text' },
    },
  },
})

const redactText = sg.wrap(async (args: RedactTextInput) => {
  const text = args.text?.trim()
  if (!text) throw new Error('text is required')

  const apiKey = getApiKey()

  const body: Record<string, unknown> = { text }
  if (args.redactedFields && args.redactedFields.length > 0) {
    body.redactedFields = args.redactedFields
  }

  const res = await fetch(`${BASE}/api/redact`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'settlegrid-tonic-textual/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Tonic Textual API error ${res.status}: ${errText}`)
  }

  const data = await res.json() as {
    redactedText?: string
    redacted_text?: string
    entities?: Array<{ type: string; start: number; end: number; original: string }>
    [key: string]: unknown
  }

  return {
    originalLength: text.length,
    redactedText: data.redactedText ?? data.redacted_text ?? '',
    entities: data.entities ?? [],
    raw: data,
  }
}, { method: 'redact_text' })

export { redactText }
console.log('settlegrid-tonic-textual MCP server ready')
console.log('Methods: redact_text')
console.log('Pricing: 3¢ per call | Powered by SettleGrid')