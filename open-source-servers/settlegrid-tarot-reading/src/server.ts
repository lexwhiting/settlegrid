/**
 * settlegrid-tarot-reading — Tarot Card Reading MCP Server
 *
 * Tarot Card Reading tools with SettleGrid billing.
 * Pricing: 1-3c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const MAJOR_ARCANA: Array<{ name: string; number: number; upright: string; reversed: string; element: string; keywords: string[] }> = [
  { name: 'The Fool', number: 0, upright: 'New beginnings, innocence, spontaneity', reversed: 'Recklessness, risk-taking, negligence', element: 'Air', keywords: ['journey', 'leap of faith'] },
  { name: 'The Magician', number: 1, upright: 'Manifestation, resourcefulness, power', reversed: 'Manipulation, poor planning, untapped talents', element: 'Mercury', keywords: ['skill', 'creation'] },
  { name: 'The High Priestess', number: 2, upright: 'Intuition, mystery, inner knowledge', reversed: 'Secrets, disconnection from intuition', element: 'Moon', keywords: ['wisdom', 'subconscious'] },
  { name: 'The Empress', number: 3, upright: 'Fertility, beauty, nature, abundance', reversed: 'Creative block, dependence', element: 'Earth', keywords: ['nurturing', 'growth'] },
  { name: 'The Emperor', number: 4, upright: 'Authority, structure, control, fatherhood', reversed: 'Tyranny, rigidity, coldness', element: 'Fire', keywords: ['leadership', 'stability'] },
  { name: 'The Lovers', number: 6, upright: 'Love, harmony, relationships, choices', reversed: 'Disharmony, imbalance, misalignment', element: 'Air', keywords: ['partnership', 'values'] },
  { name: 'The Chariot', number: 7, upright: 'Willpower, determination, success', reversed: 'Lack of direction, aggression', element: 'Water', keywords: ['victory', 'control'] },
  { name: 'Strength', number: 8, upright: 'Courage, patience, compassion, inner strength', reversed: 'Self-doubt, weakness, insecurity', element: 'Fire', keywords: ['bravery', 'influence'] },
  { name: 'The Hermit', number: 9, upright: 'Soul-searching, introspection, solitude', reversed: 'Isolation, loneliness, withdrawal', element: 'Earth', keywords: ['wisdom', 'guidance'] },
  { name: 'Wheel of Fortune', number: 10, upright: 'Good luck, karma, life cycles, turning point', reversed: 'Bad luck, resistance to change', element: 'Fire', keywords: ['fate', 'destiny'] },
  { name: 'Death', number: 13, upright: 'Endings, change, transformation, transition', reversed: 'Resistance to change, stagnation', element: 'Water', keywords: ['rebirth', 'release'] },
  { name: 'The Tower', number: 16, upright: 'Sudden upheaval, broken pride, disaster', reversed: 'Personal transformation, fear of change', element: 'Mars', keywords: ['chaos', 'revelation'] },
  { name: 'The Star', number: 17, upright: 'Hope, faith, purpose, renewal, serenity', reversed: 'Lack of faith, despair, discouragement', element: 'Air', keywords: ['inspiration', 'healing'] },
  { name: 'The Moon', number: 18, upright: 'Illusion, fear, anxiety, subconscious', reversed: 'Release of fear, repressed emotion', element: 'Water', keywords: ['intuition', 'dreams'] },
  { name: 'The Sun', number: 19, upright: 'Positivity, fun, warmth, success, vitality', reversed: 'Inner child, feeling down, overly optimistic', element: 'Fire', keywords: ['joy', 'celebration'] },
  { name: 'The World', number: 21, upright: 'Completion, integration, accomplishment', reversed: 'Shortcuts, delays, seeking closure', element: 'Earth', keywords: ['fulfillment', 'wholeness'] },
]

const SPREADS = { one_card: 1, three_card: 3, celtic_cross: 10, horseshoe: 7 }

const sg = settlegrid.init({ toolSlug: 'tarot-reading', pricing: { defaultCostCents: 1, methods: {
  draw_cards: { costCents: 1, displayName: 'Draw Cards' },
  get_card: { costCents: 1, displayName: 'Get Card Meaning' },
  list_spreads: { costCents: 1, displayName: 'List Spreads' },
}}})

const drawCards = sg.wrap(async (args: { count?: number; spread?: string }) => {
  const spread = (args.spread ?? 'three_card').toLowerCase().replace(/ /g, '_')
  const count = Math.min(args.count ?? (SPREADS[spread as keyof typeof SPREADS] ?? 3), MAJOR_ARCANA.length)
  const shuffled = [...MAJOR_ARCANA].sort(() => Math.random() - 0.5)
  const drawn = shuffled.slice(0, count).map(card => ({ ...card, reversed: Math.random() > 0.5, meaning: Math.random() > 0.5 ? card.upright : card.reversed }))
  return { spread, cards: drawn, count }
}, { method: 'draw_cards' })

const getCard = sg.wrap(async (args: { name: string }) => {
  if (!args.name) throw new Error('card name required')
  const card = MAJOR_ARCANA.find(c => c.name.toLowerCase().includes(args.name.toLowerCase()))
  if (!card) return { name: args.name, found: false, available: MAJOR_ARCANA.map(c => c.name) }
  return { ...card, found: true }
}, { method: 'get_card' })

const listSpreads = sg.wrap(async (_a: Record<string, never>) => {
  return { spreads: Object.entries(SPREADS).map(([name, cards]) => ({ name, cards })) }
}, { method: 'list_spreads' })

export { drawCards, getCard, listSpreads }
console.log('settlegrid-tarot-reading MCP server ready | Powered by SettleGrid')
