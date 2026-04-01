/**
 * settlegrid-chinese-calendar — Chinese Lunar Calendar MCP Server
 *
 * Converts between Gregorian and Chinese lunar calendar dates.
 * Provides zodiac animal, element, and traditional festival information.
 *
 * Methods:
 *   convert_date(date)            — Convert Gregorian to lunar       (1c)
 *   get_zodiac(year)              — Get Chinese zodiac for year      (1c)
 *   get_festivals(year?)          — Get traditional festivals        (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

// --- Types ------------------------------------------------------------------

interface ConvertDateInput {
  date: string
}

interface GetZodiacInput {
  year: number
}

interface GetFestivalsInput {
  year?: number
}

// --- Data -------------------------------------------------------------------

const ANIMALS = ['Rat', 'Ox', 'Tiger', 'Rabbit', 'Dragon', 'Snake', 'Horse', 'Goat', 'Monkey', 'Rooster', 'Dog', 'Pig']
const ELEMENTS = ['Wood', 'Wood', 'Fire', 'Fire', 'Earth', 'Earth', 'Metal', 'Metal', 'Water', 'Water']
const HEAVENLY_STEMS = ['Jia', 'Yi', 'Bing', 'Ding', 'Wu', 'Ji', 'Geng', 'Xin', 'Ren', 'Gui']
const EARTHLY_BRANCHES = ['Zi', 'Chou', 'Yin', 'Mao', 'Chen', 'Si', 'Wu', 'Wei', 'Shen', 'You', 'Xu', 'Hai']
const LUNAR_MONTHS = ['Zheng', 'Er', 'San', 'Si', 'Wu', 'Liu', 'Qi', 'Ba', 'Jiu', 'Shi', 'ShiYi', 'La']

const FESTIVALS: Array<{ name: string; lunar_month: number; lunar_day: number; description: string }> = [
  { name: 'Spring Festival (Chinese New Year)', lunar_month: 1, lunar_day: 1, description: 'Most important traditional holiday, family reunion' },
  { name: 'Lantern Festival', lunar_month: 1, lunar_day: 15, description: 'Lantern displays, riddle guessing, tangyuan' },
  { name: 'Qingming Festival', lunar_month: 3, lunar_day: 5, description: 'Tomb sweeping, honoring ancestors' },
  { name: 'Dragon Boat Festival', lunar_month: 5, lunar_day: 5, description: 'Dragon boat races, zongzi, commemorating Qu Yuan' },
  { name: 'Qixi Festival', lunar_month: 7, lunar_day: 7, description: 'Chinese Valentine\'s Day, the Cowherd and Weaver Girl' },
  { name: 'Mid-Autumn Festival', lunar_month: 8, lunar_day: 15, description: 'Moon viewing, mooncakes, family gathering' },
  { name: 'Double Ninth Festival', lunar_month: 9, lunar_day: 9, description: 'Mountain climbing, chrysanthemum appreciation' },
  { name: 'Winter Solstice Festival', lunar_month: 11, lunar_day: 22, description: 'Eating tangyuan or dumplings, family gathering' },
]

const ANIMAL_TRAITS: Record<string, { traits: string[]; compatible: string[]; incompatible: string[] }> = {
  Rat: { traits: ['clever', 'resourceful', 'versatile'], compatible: ['Dragon', 'Monkey', 'Ox'], incompatible: ['Horse', 'Goat'] },
  Ox: { traits: ['diligent', 'dependable', 'strong'], compatible: ['Rat', 'Snake', 'Rooster'], incompatible: ['Tiger', 'Dragon', 'Horse'] },
  Tiger: { traits: ['brave', 'competitive', 'unpredictable'], compatible: ['Dragon', 'Horse', 'Pig'], incompatible: ['Ox', 'Tiger', 'Snake'] },
  Rabbit: { traits: ['quiet', 'elegant', 'kind'], compatible: ['Goat', 'Dog', 'Pig'], incompatible: ['Snake', 'Rooster'] },
  Dragon: { traits: ['confident', 'intelligent', 'enthusiastic'], compatible: ['Rooster', 'Rat', 'Monkey'], incompatible: ['Ox', 'Goat', 'Dog'] },
  Snake: { traits: ['enigmatic', 'intelligent', 'wise'], compatible: ['Dragon', 'Rooster'], incompatible: ['Tiger', 'Rabbit', 'Snake'] },
  Horse: { traits: ['animated', 'active', 'energetic'], compatible: ['Tiger', 'Goat', 'Rabbit'], incompatible: ['Rat', 'Ox'] },
  Goat: { traits: ['calm', 'gentle', 'sympathetic'], compatible: ['Rabbit', 'Horse', 'Pig'], incompatible: ['Ox', 'Dragon'] },
  Monkey: { traits: ['sharp', 'smart', 'curiosity'], compatible: ['Ox', 'Rabbit'], incompatible: ['Tiger', 'Pig'] },
  Rooster: { traits: ['observant', 'hardworking', 'courageous'], compatible: ['Ox', 'Snake'], incompatible: ['Rat', 'Rabbit'] },
  Dog: { traits: ['loyal', 'honest', 'amiable'], compatible: ['Rabbit', 'Tiger', 'Horse'], incompatible: ['Dragon', 'Goat', 'Rooster'] },
  Pig: { traits: ['compassionate', 'generous', 'diligent'], compatible: ['Tiger', 'Rabbit', 'Goat'], incompatible: ['Snake', 'Monkey'] },
}

// --- SettleGrid Init --------------------------------------------------------

const sg = settlegrid.init({
  toolSlug: 'chinese-calendar',
  pricing: {
    defaultCostCents: 1,
    methods: {
      convert_date: { costCents: 1, displayName: 'Convert Date' },
      get_zodiac: { costCents: 1, displayName: 'Get Chinese Zodiac' },
      get_festivals: { costCents: 1, displayName: 'Get Festivals' },
    },
  },
})

// --- Handlers ---------------------------------------------------------------

const convertDate = sg.wrap(async (args: ConvertDateInput) => {
  if (!args.date) throw new Error('date required (YYYY-MM-DD)')
  const d = new Date(args.date)
  if (isNaN(d.getTime())) throw new Error('Invalid date format')

  const year = d.getFullYear()
  const animalIdx = (year - 4) % 12
  const elementIdx = (year - 4) % 10
  const stemIdx = (year - 4) % 10
  const branchIdx = (year - 4) % 12

  // Approximate lunar month (simplified algorithm)
  const dayOfYear = Math.floor((d.getTime() - new Date(year, 0, 0).getTime()) / 86400000)
  const lunarMonthApprox = Math.max(1, Math.min(12, Math.floor((dayOfYear - 20) / 29.5) + 1))
  const lunarDayApprox = Math.max(1, ((dayOfYear - 20) % 30) + 1)

  return {
    gregorian: args.date,
    lunar: {
      year,
      month: lunarMonthApprox,
      month_name: LUNAR_MONTHS[lunarMonthApprox - 1] ?? 'Unknown',
      day: lunarDayApprox,
    },
    animal: ANIMALS[animalIdx],
    element: ELEMENTS[elementIdx],
    heavenly_stem: HEAVENLY_STEMS[stemIdx],
    earthly_branch: EARTHLY_BRANCHES[branchIdx],
    yin_yang: year % 2 === 0 ? 'Yang' : 'Yin',
    sexagenary_cycle: `${HEAVENLY_STEMS[stemIdx]}-${EARTHLY_BRANCHES[branchIdx]}`,
    note: 'Lunar date is approximate — actual dates depend on astronomical observation',
  }
}, { method: 'convert_date' })

const getZodiac = sg.wrap(async (args: GetZodiacInput) => {
  if (!args.year || args.year < 1900 || args.year > 2100) {
    throw new Error('year required (1900-2100)')
  }
  const animalIdx = (args.year - 4) % 12
  const elementIdx = (args.year - 4) % 10
  const animal = ANIMALS[animalIdx]
  const traits = ANIMAL_TRAITS[animal]

  return {
    year: args.year,
    animal,
    element: ELEMENTS[elementIdx],
    yin_yang: args.year % 2 === 0 ? 'Yang' : 'Yin',
    traits: traits?.traits ?? [],
    compatible_with: traits?.compatible ?? [],
    incompatible_with: traits?.incompatible ?? [],
  }
}, { method: 'get_zodiac' })

const getFestivals = sg.wrap(async (args: GetFestivalsInput) => {
  const year = args.year ?? new Date().getFullYear()
  return {
    year,
    festivals: FESTIVALS,
    count: FESTIVALS.length,
    note: 'Festival dates shown in lunar calendar — Gregorian dates vary each year',
  }
}, { method: 'get_festivals' })

// --- Exports ----------------------------------------------------------------

export { convertDate, getZodiac, getFestivals }

console.log('settlegrid-chinese-calendar MCP server ready')
console.log('Methods: convert_date, get_zodiac, get_festivals')
console.log('Pricing: 1c per call | Powered by SettleGrid')
