/**
 * settlegrid-cartesia — Cartesia TTS MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface SynthesizeSpeechInput {
  text: string
  voice_id: string
  model_id?: string
  output_format?: string
  language?: string
}

const BASE = 'https://api.cartesia.ai'

function getApiKey(): string {
  const k = process.env.CARTESIA_API_KEY
  if (!k) throw new Error('CARTESIA_API_KEY environment variable is required')
  return k
}

const sg = settlegrid.init({
  toolSlug: 'cartesia',
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
  if (text.length > 5000) throw new Error('text must be 5000 characters or fewer')

  const voiceId = args.voice_id?.trim()
  if (!voiceId) throw new Error('voice_id is required')

  const modelId = args.model_id?.trim() || 'sonic-2'
  const rawFormat = args.output_format?.trim().toLowerCase() || 'mp3'
  const allowedFormats = ['mp3', 'wav', 'pcm']
  const outputFormat = allowedFormats.includes(rawFormat) ? rawFormat : 'mp3'
  const language = args.language?.trim() || 'en'

  const formatMap: Record<string, { container: string; encoding: string; sample_rate: number }> = {
    mp3: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
    wav: { container: 'wav', encoding: 'pcm_f32le', sample_rate: 44100 },
    pcm: { container: 'raw', encoding: 'pcm_f32le', sample_rate: 44100 },
  }
  const formatSpec = formatMap[outputFormat]

  const body = {
    model_id: modelId,
    transcript: text,
    voice: {
      mode: 'id',
      id: voiceId,
    },
    output_format: formatSpec,
    language,
  }

  const res = await fetch(`${BASE}/tts/bytes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      'Cartesia-Version': '2024-06-10',
      'User-Agent': 'settlegrid-cartesia/1.0',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Cartesia API error ${res.status}: ${errText}`)
  }

  const audioBuffer = await res.arrayBuffer()
  const base64Audio = Buffer.from(audioBuffer).toString('base64')

  return {
    model_id: modelId,
    voice_id: voiceId,
    language,
    output_format: outputFormat,
    audio_base64: base64Audio,
    byte_length: audioBuffer.byteLength,
    message: `Audio successfully synthesized. ${audioBuffer.byteLength} bytes of ${outputFormat.toUpperCase()} audio returned as base64.`,
  }
}, { method: 'synthesize_speech' })

export { synthesizeSpeech }
console.log('settlegrid-cartesia MCP server ready')
console.log('Methods: synthesize_speech')
console.log('Pricing: 5¢ per call | Powered by SettleGrid')