/**
 * settlegrid-assemblyai — AssemblyAI MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.assemblyai.com'
const USER_AGENT = 'settlegrid-assemblyai/1.0'

function getApiKey(): string {
  const k = process.env.ASSEMBLYAI_API_KEY
  if (!k) throw new Error('ASSEMBLYAI_API_KEY environment variable is required')
  return k
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Authorization': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AssemblyAI API error ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

interface SubmitTranscriptionInput {
  audio_url: string
  language_code?: string
  speaker_labels?: boolean
}

interface GetTranscriptionInput {
  transcript_id: string
}

interface ListTranscriptionsInput {
  limit?: number
}

interface GetTranscriptSentencesInput {
  transcript_id: string
}

interface ExportTranscriptInput {
  transcript_id: string
  format: string
}

interface GenerateSummaryInput {
  transcript_ids: string
  context?: string
}

interface AskLemurInput {
  transcript_ids: string
  question: string
}

interface GenerateActionItemsInput {
  transcript_ids: string
  context?: string
}

const sg = settlegrid.init({
  toolSlug: 'assemblyai',
  pricing: {
    defaultCostCents: 1,
    methods: {
      submit_transcription: { costCents: 5, displayName: 'Submit Transcription' },
      get_transcription: { costCents: 1, displayName: 'Get Transcription' },
      list_transcriptions: { costCents: 1, displayName: 'List Transcriptions' },
      get_transcript_sentences: { costCents: 1, displayName: 'Get Transcript Sentences' },
      export_transcript: { costCents: 2, displayName: 'Export Transcript' },
      generate_summary: { costCents: 8, displayName: 'Generate Summary' },
      ask_lemur: { costCents: 8, displayName: 'Ask LeMUR' },
      generate_action_items: { costCents: 8, displayName: 'Generate Action Items' },
    },
  },
})

const submitTranscription = sg.wrap(async (args: SubmitTranscriptionInput) => {
  const url = args.audio_url?.trim()
  if (!url) throw new Error('audio_url is required')
  const body: Record<string, unknown> = { audio_url: url }
  if (args.language_code) body.language_code = args.language_code.trim()
  if (args.speaker_labels !== undefined) body.speaker_labels = args.speaker_labels
  const data = await apiFetch('/v2/transcript', { method: 'POST', body })
  return data
}, { method: 'submit_transcription' })

const getTranscription = sg.wrap(async (args: GetTranscriptionInput) => {
  const id = args.transcript_id?.trim()
  if (!id) throw new Error('transcript_id is required')
  const data = await apiFetch(`/v2/transcript/${encodeURIComponent(id)}`)
  return data
}, { method: 'get_transcription' })

const listTranscriptions = sg.wrap(async (args: ListTranscriptionsInput) => {
  const limit = Math.min(args.limit || 10, 50)
  const data = await apiFetch(`/v2/transcript?limit=${limit}`) as { transcripts: unknown[]; page_details: unknown }
  return { count: Array.isArray(data.transcripts) ? data.transcripts.length : 0, transcripts: data.transcripts, page_details: data.page_details }
}, { method: 'list_transcriptions' })

const getTranscriptSentences = sg.wrap(async (args: GetTranscriptSentencesInput) => {
  const id = args.transcript_id?.trim()
  if (!id) throw new Error('transcript_id is required')
  const data = await apiFetch(`/v2/transcript/${encodeURIComponent(id)}/sentences`)
  return data
}, { method: 'get_transcript_sentences' })

const exportTranscript = sg.wrap(async (args: ExportTranscriptInput) => {
  const id = args.transcript_id?.trim()
  if (!id) throw new Error('transcript_id is required')
  const fmt = args.format?.trim().toLowerCase()
  if (!fmt || !['srt', 'vtt'].includes(fmt)) throw new Error('format must be "srt" or "vtt"')
  const apiKey = getApiKey()
  const res = await fetch(`${BASE}/v2/transcript/${encodeURIComponent(id)}/${fmt}`, {
    method: 'GET',
    headers: {
      'Authorization': apiKey,
      'User-Agent': USER_AGENT,
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`AssemblyAI API error ${res.status}: ${text.slice(0, 300)}`)
  }
  const text = await res.text()
  return { format: fmt, content: text }
}, { method: 'export_transcript' })

const generateSummary = sg.wrap(async (args: GenerateSummaryInput) => {
  const ids = args.transcript_ids?.split(',').map((s: string) => s.trim()).filter(Boolean)
  if (!ids || ids.length === 0) throw new Error('transcript_ids is required')
  const body: Record<string, unknown> = { transcript_ids: ids }
  if (args.context) body.context = args.context.trim()
  const data = await apiFetch('/lemur/v3/generate/summary', { method: 'POST', body })
  return data
}, { method: 'generate_summary' })

const askLemur = sg.wrap(async (args: AskLemurInput) => {
  const ids = args.transcript_ids?.split(',').map((s: string) => s.trim()).filter(Boolean)
  if (!ids || ids.length === 0) throw new Error('transcript_ids is required')
  const question = args.question?.trim()
  if (!question) throw new Error('question is required')
  const body = {
    transcript_ids: ids,
    questions: [{ question }],
  }
  const data = await apiFetch('/lemur/v3/generate/question-answer', { method: 'POST', body })
  return data
}, { method: 'ask_lemur' })

const generateActionItems = sg.wrap(async (args: GenerateActionItemsInput) => {
  const ids = args.transcript_ids?.split(',').map((s: string) => s.trim()).filter(Boolean)
  if (!ids || ids.length === 0) throw new Error('transcript_ids is required')
  const body: Record<string, unknown> = { transcript_ids: ids }
  if (args.context) body.context = args.context.trim()
  const data = await apiFetch('/lemur/v3/generate/action-items', { method: 'POST', body })
  return data
}, { method: 'generate_action_items' })

export {
  submitTranscription,
  getTranscription,
  listTranscriptions,
  getTranscriptSentences,
  exportTranscript,
  generateSummary,
  askLemur,
  generateActionItems,
}

console.log('settlegrid-assemblyai MCP server ready')
console.log('Methods: submit_transcription, get_transcription, list_transcriptions, get_transcript_sentences, export_transcript, generate_summary, ask_lemur, generate_action_items')
console.log('Pricing: 1-8¢ per call | Powered by SettleGrid')