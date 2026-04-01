/**
 * settlegrid-nato-alphabet — NATO Phonetic Alphabet MCP Server
 *
 * NATO Phonetic Alphabet tools with SettleGrid billing.
 *
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const NATO: Record<string, string> = { A:'Alpha',B:'Bravo',C:'Charlie',D:'Delta',E:'Echo',F:'Foxtrot',G:'Golf',H:'Hotel',I:'India',J:'Juliet',K:'Kilo',L:'Lima',M:'Mike',N:'November',O:'Oscar',P:'Papa',Q:'Quebec',R:'Romeo',S:'Sierra',T:'Tango',U:'Uniform',V:'Victor',W:'Whiskey',X:'X-ray',Y:'Yankee',Z:'Zulu','0':'Zero','1':'One','2':'Two','3':'Three','4':'Four','5':'Five','6':'Six','7':'Seven','8':'Eight','9':'Niner' }
const REVERSE: Record<string, string> = {}
for (const [k, v] of Object.entries(NATO)) REVERSE[v.toLowerCase()] = k

const sg = settlegrid.init({
  toolSlug: 'nato-alphabet',
  pricing: { defaultCostCents: 1, methods: {
    to_nato: { costCents: 1, displayName: 'Text to NATO' },
    from_nato: { costCents: 1, displayName: 'NATO to Text' },
    get_alphabet: { costCents: 1, displayName: 'Get Alphabet' },
  }},
})

const toNato = sg.wrap(async (args: { text: string }) => {
  if (!args.text) throw new Error('text required')
  const words = args.text.toUpperCase().split('').map(c => c === ' ' ? '(space)' : (NATO[c] ?? c))
  return { text: args.text, nato: words.join(' '), words }
}, { method: 'to_nato' })

const fromNato = sg.wrap(async (args: { nato: string }) => {
  if (!args.nato) throw new Error('nato required (space-separated NATO words)')
  const text = args.nato.split(' ').map(w => w === '(space)' ? ' ' : (REVERSE[w.toLowerCase()] ?? '?')).join('')
  return { nato: args.nato, text }
}, { method: 'from_nato' })

const getAlphabet = sg.wrap(async (_a: Record<string, never>) => {
  return { alphabet: Object.entries(NATO).map(([char, word]) => ({ char, word })), count: Object.keys(NATO).length }
}, { method: 'get_alphabet' })

export { toNato, fromNato, getAlphabet }
console.log('settlegrid-nato-alphabet MCP server ready | Powered by SettleGrid')
