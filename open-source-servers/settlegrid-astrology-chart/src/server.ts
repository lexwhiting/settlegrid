/**
 * settlegrid-astrology-chart — Zodiac & Astrology MCP Server
 *
 * Provides zodiac sign lookup, compatibility analysis, and daily attributes.
 * All calculations done locally using astronomical date ranges.
 *
 * Methods:
 *   get_zodiac(sign?, month?, day?)   — Get zodiac sign details      (1¢)
 *   get_compatibility(a, b)           — Check sign compatibility     (1¢)
 *   get_chinese_zodiac(year)          — Get Chinese zodiac animal    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetZodiacInput {
  sign?: string
  month?: number
  day?: number
}

interface GetCompatibilityInput {
  sign_a: string
  sign_b: string
}

interface GetChineseZodiacInput {
  year: number
}

interface SignData {
  dates: string
  element: string
  quality: string
  ruling_planet: string
  symbol: string
  traits: string[]
  strengths: string[]
  weaknesses: string[]
}

// ─── Data ───────────────────────────────────────────────────────────────────

const SIGNS: Record<string, SignData> = {
  aries: { dates: 'Mar 21 - Apr 19', element: 'Fire', quality: 'Cardinal', ruling_planet: 'Mars', symbol: 'Ram', traits: ['bold', 'ambitious', 'energetic', 'competitive'], strengths: ['courageous', 'determined', 'confident'], weaknesses: ['impatient', 'aggressive', 'impulsive'] },
  taurus: { dates: 'Apr 20 - May 20', element: 'Earth', quality: 'Fixed', ruling_planet: 'Venus', symbol: 'Bull', traits: ['reliable', 'patient', 'practical', 'stubborn'], strengths: ['dependable', 'persistent', 'loyal'], weaknesses: ['possessive', 'uncompromising', 'stubborn'] },
  gemini: { dates: 'May 21 - Jun 20', element: 'Air', quality: 'Mutable', ruling_planet: 'Mercury', symbol: 'Twins', traits: ['versatile', 'curious', 'social', 'witty'], strengths: ['adaptable', 'outgoing', 'intelligent'], weaknesses: ['inconsistent', 'indecisive', 'nervous'] },
  cancer: { dates: 'Jun 21 - Jul 22', element: 'Water', quality: 'Cardinal', ruling_planet: 'Moon', symbol: 'Crab', traits: ['intuitive', 'emotional', 'nurturing', 'protective'], strengths: ['tenacious', 'loyal', 'sympathetic'], weaknesses: ['moody', 'pessimistic', 'clingy'] },
  leo: { dates: 'Jul 23 - Aug 22', element: 'Fire', quality: 'Fixed', ruling_planet: 'Sun', symbol: 'Lion', traits: ['creative', 'passionate', 'generous', 'dramatic'], strengths: ['creative', 'warmhearted', 'cheerful'], weaknesses: ['arrogant', 'stubborn', 'self-centered'] },
  virgo: { dates: 'Aug 23 - Sep 22', element: 'Earth', quality: 'Mutable', ruling_planet: 'Mercury', symbol: 'Maiden', traits: ['analytical', 'practical', 'modest', 'diligent'], strengths: ['loyal', 'hardworking', 'kind'], weaknesses: ['shyness', 'worry', 'overly critical'] },
  libra: { dates: 'Sep 23 - Oct 22', element: 'Air', quality: 'Cardinal', ruling_planet: 'Venus', symbol: 'Scales', traits: ['diplomatic', 'fair', 'social', 'gracious'], strengths: ['cooperative', 'fair-minded', 'diplomatic'], weaknesses: ['indecisive', 'avoids confrontation', 'self-pity'] },
  scorpio: { dates: 'Oct 23 - Nov 21', element: 'Water', quality: 'Fixed', ruling_planet: 'Pluto', symbol: 'Scorpion', traits: ['passionate', 'resourceful', 'intense', 'loyal'], strengths: ['brave', 'resourceful', 'focused'], weaknesses: ['jealous', 'secretive', 'controlling'] },
  sagittarius: { dates: 'Nov 22 - Dec 21', element: 'Fire', quality: 'Mutable', ruling_planet: 'Jupiter', symbol: 'Archer', traits: ['optimistic', 'adventurous', 'direct', 'philosophical'], strengths: ['generous', 'idealistic', 'great humor'], weaknesses: ['promises more than can deliver', 'impatient', 'tactless'] },
  capricorn: { dates: 'Dec 22 - Jan 19', element: 'Earth', quality: 'Cardinal', ruling_planet: 'Saturn', symbol: 'Sea-Goat', traits: ['disciplined', 'responsible', 'ambitious', 'practical'], strengths: ['responsible', 'disciplined', 'self-control'], weaknesses: ['know-it-all', 'unforgiving', 'condescending'] },
  aquarius: { dates: 'Jan 20 - Feb 18', element: 'Air', quality: 'Fixed', ruling_planet: 'Uranus', symbol: 'Water Bearer', traits: ['independent', 'innovative', 'humanitarian', 'eccentric'], strengths: ['progressive', 'original', 'independent'], weaknesses: ['runs from expression', 'temperamental', 'aloof'] },
  pisces: { dates: 'Feb 19 - Mar 20', element: 'Water', quality: 'Mutable', ruling_planet: 'Neptune', symbol: 'Fish', traits: ['empathetic', 'artistic', 'intuitive', 'gentle'], strengths: ['compassionate', 'artistic', 'wise'], weaknesses: ['fearful', 'overly trusting', 'desire to escape'] },
}

const COMPAT_ELEMENTS: Record<string, string> = { Fire: 'Air', Air: 'Fire', Earth: 'Water', Water: 'Earth' }

const CHINESE_ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig']
const CHINESE_ELEMENTS_CYCLE = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water']

function getSignFromDate(month: number, day: number): string {
  const dateNum = month * 100 + day
  if (dateNum >= 321 && dateNum <= 419) return 'aries'
  if (dateNum >= 420 && dateNum <= 520) return 'taurus'
  if (dateNum >= 521 && dateNum <= 620) return 'gemini'
  if (dateNum >= 621 && dateNum <= 722) return 'cancer'
  if (dateNum >= 723 && dateNum <= 822) return 'leo'
  if (dateNum >= 823 && dateNum <= 922) return 'virgo'
  if (dateNum >= 923 && dateNum <= 1022) return 'libra'
  if (dateNum >= 1023 && dateNum <= 1121) return 'scorpio'
  if (dateNum >= 1122 && dateNum <= 1221) return 'sagittarius'
  if (dateNum >= 1222 || dateNum <= 119) return 'capricorn'
  if (dateNum >= 120 && dateNum <= 218) return 'aquarius'
  return 'pisces'
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'astrology-chart',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_zodiac: { costCents: 1, displayName: 'Get Zodiac Sign' },
      get_compatibility: { costCents: 1, displayName: 'Get Compatibility' },
      get_chinese_zodiac: { costCents: 1, displayName: 'Get Chinese Zodiac' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getZodiac = sg.wrap(async (args: GetZodiacInput) => {
  let signName: string

  if (args.sign) {
    signName = args.sign.toLowerCase()
    if (!SIGNS[signName]) {
      throw new Error(`Unknown sign "${args.sign}". Available: ${Object.keys(SIGNS).join(', ')}`)
    }
  } else if (args.month && args.day) {
    if (args.month < 1 || args.month > 12 || args.day < 1 || args.day > 31) {
      throw new Error('Invalid month (1-12) or day (1-31)')
    }
    signName = getSignFromDate(args.month, args.day)
  } else {
    throw new Error('Provide either sign name OR month + day')
  }

  return { sign: signName, ...SIGNS[signName] }
}, { method: 'get_zodiac' })

const getCompatibility = sg.wrap(async (args: GetCompatibilityInput) => {
  if (!args.sign_a || !args.sign_b) {
    throw new Error('sign_a and sign_b are required')
  }
  const a = SIGNS[args.sign_a.toLowerCase()]
  const b = SIGNS[args.sign_b.toLowerCase()]
  if (!a || !b) {
    throw new Error('Invalid sign(s). Use lowercase sign names.')
  }

  const sameElement = a.element === b.element
  const complementary = COMPAT_ELEMENTS[a.element] === b.element
  const sameQuality = a.quality === b.quality
  const score = sameElement ? 90 : complementary ? 80 : sameQuality ? 55 : 50

  let description: string
  if (sameElement) description = 'Natural harmony — you share the same elemental energy'
  else if (complementary) description = 'Complementary energies — you balance each other'
  else if (sameQuality) description = 'Similar approach to life but different energies — requires compromise'
  else description = 'Challenging but growth-oriented pairing'

  return {
    sign_a: args.sign_a.toLowerCase(),
    sign_b: args.sign_b.toLowerCase(),
    compatibility_score: score,
    same_element: sameElement,
    complementary,
    description,
  }
}, { method: 'get_compatibility' })

const getChineseZodiac = sg.wrap(async (args: GetChineseZodiacInput) => {
  if (!args.year || args.year < 1900 || args.year > 2100) {
    throw new Error('year is required (1900-2100)')
  }
  const animalIndex = (args.year - 4) % 12
  const elementIndex = (args.year - 4) % 10
  return {
    year: args.year,
    animal: CHINESE_ANIMALS[animalIndex],
    element: CHINESE_ELEMENTS_CYCLE[elementIndex],
    yin_yang: args.year % 2 === 0 ? 'Yang' : 'Yin',
  }
}, { method: 'get_chinese_zodiac' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getZodiac, getCompatibility, getChineseZodiac }

console.log('settlegrid-astrology-chart MCP server ready')
console.log('Methods: get_zodiac, get_compatibility, get_chinese_zodiac')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
