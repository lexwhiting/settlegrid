/**
 * settlegrid-morse-code — Morse Code Translator MCP Server
 *
 * Morse Code Translator tools with SettleGrid billing.
 *
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const TO_MORSE: Record<string, string> = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',
  '0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.',
  '.':'.-.-.-',',':'--..--','?':'..--..','/':'-..-.','-':'-....-','(':'-.--.',')':'-.--.-',' ':' / ' }
const FROM_MORSE: Record<string, string> = {}
for (const [k, v] of Object.entries(TO_MORSE)) { if (k !== ' ') FROM_MORSE[v] = k }

const sg = settlegrid.init({
  toolSlug: 'morse-code',
  pricing: { defaultCostCents: 1, methods: {
    to_morse: { costCents: 1, displayName: 'Text to Morse' },
    from_morse: { costCents: 1, displayName: 'Morse to Text' },
    get_chart: { costCents: 1, displayName: 'Get Morse Chart' },
  }},
})

const toMorse = sg.wrap(async (args: { text: string }) => {
  if (!args.text) throw new Error('text required')
  const morse = args.text.toUpperCase().split('').map(c => TO_MORSE[c] ?? c).join(' ')
  return { text: args.text, morse, char_count: args.text.length }
}, { method: 'to_morse' })

const fromMorse = sg.wrap(async (args: { morse: string }) => {
  if (!args.morse) throw new Error('morse required')
  const words = args.morse.split(' / ')
  const text = words.map(w => w.split(' ').map(c => FROM_MORSE[c] ?? '?').join('')).join(' ')
  return { morse: args.morse, text }
}, { method: 'from_morse' })

const getChart = sg.wrap(async (_a: Record<string, never>) => {
  return { chart: Object.entries(TO_MORSE).filter(([k]) => k !== ' ').map(([char, morse]) => ({ char, morse })), timing: { dit: '1 unit', dah: '3 units', intra_char: '1 unit', inter_char: '3 units', inter_word: '7 units' } }
}, { method: 'get_chart' })

export { toMorse, fromMorse, getChart }
console.log('settlegrid-morse-code MCP server ready | Powered by SettleGrid')
