/**
 * settlegrid-sign-language — Sign Language Reference MCP Server
 *
 * Sign Language Reference tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const ASL_ALPHABET: Record<string, { description: string; hand_shape: string }> = {
  A: { description: 'Fist with thumb on side', hand_shape: 'Closed fist, thumb alongside index finger' },
  B: { description: 'Flat hand, fingers together', hand_shape: 'Open hand, fingers together pointing up, thumb across palm' },
  C: { description: 'Curved hand like letter C', hand_shape: 'Hand curved in C shape, thumb and fingers apart' },
  D: { description: 'Index up, others touch thumb', hand_shape: 'Index finger pointing up, others curved to touch thumb' },
  I: { description: 'Pinky up', hand_shape: 'Fist with pinky extended upward' },
  L: { description: 'L shape with thumb and index', hand_shape: 'Index finger up, thumb extended to side, forming L' },
  O: { description: 'All fingers touch thumb in O', hand_shape: 'All fingertips touching thumb, forming O circle' },
  Y: { description: 'Thumb and pinky extended', hand_shape: 'Fist with thumb and pinky extended (shaka/hang loose)' },
}

const COMMON_SIGNS: Record<string, string> = {
  hello: 'Open hand, touch forehead and move outward (like a salute)',
  thank_you: 'Touch chin/lips with flat hand, move forward and down',
  please: 'Rub chest in circular motion with open hand',
  sorry: 'Make fist, rub in circle on chest',
  yes: 'Make S handshape, nod fist up and down',
  no: 'Extend index and middle finger, snap closed to thumb',
  help: 'Place fist on open palm, lift both up',
  love: 'Cross arms over chest (ILY: thumb+index+pinky extended)',
}

const sg = settlegrid.init({ toolSlug: 'sign-language', pricing: { defaultCostCents: 1, methods: {
  get_letter: { costCents: 1, displayName: 'Get ASL Letter' },
  get_sign: { costCents: 1, displayName: 'Get Common Sign' },
  spell_word: { costCents: 1, displayName: 'Spell Word in ASL' },
}}})

const getLetter = sg.wrap(async (args: { letter: string }) => {
  if (!args.letter) throw new Error('letter required')
  const l = args.letter.toUpperCase()[0]
  const info = ASL_ALPHABET[l]
  if (!info) return { letter: l, note: 'Not in reduced database. Full ASL fingerspelling covers A-Z.' }
  return { letter: l, ...info }
}, { method: 'get_letter' })

const getSign = sg.wrap(async (args: { word: string }) => {
  if (!args.word) throw new Error('word required')
  const sign = COMMON_SIGNS[args.word.toLowerCase().replace(/ /g, '_')]
  if (!sign) throw new Error(`Not found. Available: ${Object.keys(COMMON_SIGNS).join(', ')}`)
  return { word: args.word, description: sign, language: 'ASL (American Sign Language)' }
}, { method: 'get_sign' })

const spellWord = sg.wrap(async (args: { word: string }) => {
  if (!args.word) throw new Error('word required')
  const letters = args.word.toUpperCase().split('').map(l => ({ letter: l, description: ASL_ALPHABET[l]?.hand_shape ?? 'See ASL alphabet chart' }))
  return { word: args.word, fingerspelling: letters, count: letters.length }
}, { method: 'spell_word' })

export { getLetter, getSign, spellWord }
console.log('settlegrid-sign-language MCP server ready | Powered by SettleGrid')
