/**
 * settlegrid-rime-ai — Rime AI Text-to-Speech MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface SynthesizeSpeechInput {
  text: string
  speaker?: string
  audioFormat?: string
  samplingRate?: number
  speedAlpha?: number
  reduceLatency?: boolean
}

const BASE = 'https://users.rime.ai'

function getApiKey(): string {
  const k = process.env.RIME_API_KEY
  if (!k) throw new Error('RIME_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'rime-ai',
  pricing: {
    defaultCostCents: 5,
    methods: {
      synthesize_speech: { costCents: 5, displayName: 'Synthesize Speech' },
    },
  },
})

const synthesizeSpeech = sg.wrap(async (args: SynthesizeSpeechInput) => {
  const apiKey = getApiKey()

  const text = args.text?.trim()
  if (!text) throw new Error('text is required')

  const body: Record<string, unknown> = { text }
  if (args.speaker) body.speaker = args.speaker.trim()
  if (args.audioFormat) body.audioFormat = args.audioFormat.trim()
  if (args.samplingRate !== undefined) body.samplingRate = args.samplingRate
  if (args.speedAlpha !== undefined) body.speedAlpha = args.speedAlpha
  if (args.reduceLatency !== undefined) body.reduceLatency = args.reduceLatency

  const res = await fetch(`${BASE}/v1/rime-tts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'audio/*, application/json',
      'User-Agent': 'settlegrid-rime-ai/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Rime AI API error ${res.status}: ${errText.slice(0, 300)}`)
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    const data = await res.json()
    return data
  }

  // Binary audio response — return base64-encoded with metadata
  const arrayBuffer = await res.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString('base64')
  return {
    contentType,
    encoding: 'base64',
    audioData: base64,
    byteLength: arrayBuffer.byteLength,
    speaker: args.speaker ?? 'default',
    audioFormat: args.audioFormat ?? 'default',
  }
}, { method: 'synthesize_speech' })

export { synthesizeSpeech }
console.log('settlegrid-rime-ai MCP server ready')
console.log('Methods: synthesize_speech')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')