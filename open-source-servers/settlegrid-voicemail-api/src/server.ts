/**
 * settlegrid-voicemail-api — Voicemail Greeting Generator MCP Server
 *
 * Voicemail Greeting Generator tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

interface GreetingInput { name: string; type?: string; company?: string; phone?: string }
interface TranscriptionInput { text: string; caller?: string; duration_seconds?: number }

const GREETING_TEMPLATES: Record<string, (args: GreetingInput) => string> = {
  professional: (a) => `You have reached ${a.name}${a.company ? ' at ' + a.company : ''}. I am unable to take your call right now. Please leave your name, number, and a brief message, and I will return your call as soon as possible. Thank you.`,
  casual: (a) => `Hey, this is ${a.name}! Sorry I missed your call. Leave a message and I'll get back to you soon!`,
  after_hours: (a) => `Thank you for calling${a.company ? ' ' + a.company : ''}. Our office hours are Monday through Friday, 9 AM to 5 PM. Please leave a message and we will return your call on the next business day.`,
  vacation: (a) => `Hi, you've reached ${a.name}. I am currently out of the office and will return on [date]. For urgent matters, please contact [alternate contact]. Otherwise, leave a message and I'll respond when I return.`,
  bilingual: (a) => `You have reached ${a.name}. Para espanol, oprima dos. Please leave a message after the tone. Deje un mensaje despues del tono.`,
  medical: (a) => `You have reached the office of ${a.name}. If this is a medical emergency, please hang up and call 911. For non-urgent matters, please leave your name, date of birth, and a callback number.`,
}

const sg = settlegrid.init({ toolSlug: 'voicemail-api', pricing: { defaultCostCents: 1, methods: {
  generate_greeting: { costCents: 1, displayName: 'Generate Greeting' },
  format_transcription: { costCents: 1, displayName: 'Format Transcription' },
  list_templates: { costCents: 1, displayName: 'List Templates' },
}}})

const generateGreeting = sg.wrap(async (args: GreetingInput) => {
  if (!args.name) throw new Error('name required')
  const type = args.type ?? 'professional'
  const gen = GREETING_TEMPLATES[type]
  if (!gen) throw new Error(`Unknown type. Available: ${Object.keys(GREETING_TEMPLATES).join(', ')}`)
  const text = gen(args)
  return { greeting: text, type, word_count: text.split(' ').length, estimated_seconds: Math.round(text.split(' ').length / 2.5), char_count: text.length }
}, { method: 'generate_greeting' })

const formatTranscription = sg.wrap(async (args: TranscriptionInput) => {
  if (!args.text) throw new Error('text required')
  const words = args.text.split(/\s+/).length
  return { transcription: args.text, caller: args.caller ?? 'Unknown', duration_seconds: args.duration_seconds ?? Math.round(words / 2.5), word_count: words, timestamp: new Date().toISOString(), sentiment: args.text.includes('urgent') || args.text.includes('important') ? 'urgent' : 'normal' }
}, { method: 'format_transcription' })

const listTemplates = sg.wrap(async (_a: Record<string, never>) => {
  return { templates: Object.keys(GREETING_TEMPLATES).map(name => ({ name, description: name.replace(/_/g, ' ') })), count: Object.keys(GREETING_TEMPLATES).length }
}, { method: 'list_templates' })

export { generateGreeting, formatTranscription, listTemplates }
console.log('settlegrid-voicemail-api MCP server ready | Powered by SettleGrid')
