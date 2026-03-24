/**
 * settlegrid-horoscope — Daily Horoscope MCP Server
 *
 * Methods:
 *   get_horoscope(sign, day)         (1¢)
 *   get_all_signs()                  (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GetHoroscopeInput { sign: string; day?: string }

const API_BASE = 'https://horoscope-app-api.vercel.app/api/v1/get-horoscope/daily'
const USER_AGENT = 'settlegrid-horoscope/1.0 (contact@settlegrid.ai)'

const SIGNS = ['aries','taurus','gemini','cancer','leo','virgo','libra','scorpio','sagittarius','capricorn','aquarius','pisces']
const SIGN_DATA = [
  { sign: 'aries', dates: 'Mar 21 - Apr 19', element: 'Fire' },
  { sign: 'taurus', dates: 'Apr 20 - May 20', element: 'Earth' },
  { sign: 'gemini', dates: 'May 21 - Jun 20', element: 'Air' },
  { sign: 'cancer', dates: 'Jun 21 - Jul 22', element: 'Water' },
  { sign: 'leo', dates: 'Jul 23 - Aug 22', element: 'Fire' },
  { sign: 'virgo', dates: 'Aug 23 - Sep 22', element: 'Earth' },
  { sign: 'libra', dates: 'Sep 23 - Oct 22', element: 'Air' },
  { sign: 'scorpio', dates: 'Oct 23 - Nov 21', element: 'Water' },
  { sign: 'sagittarius', dates: 'Nov 22 - Dec 21', element: 'Fire' },
  { sign: 'capricorn', dates: 'Dec 22 - Jan 19', element: 'Earth' },
  { sign: 'aquarius', dates: 'Jan 20 - Feb 18', element: 'Air' },
  { sign: 'pisces', dates: 'Feb 19 - Mar 20', element: 'Water' },
]

const sg = settlegrid.init({
  toolSlug: 'horoscope',
  pricing: { defaultCostCents: 1, methods: {
    get_horoscope: { costCents: 1, displayName: 'Get daily horoscope' },
    get_all_signs: { costCents: 1, displayName: 'Get all zodiac signs' },
  }},
})

const getHoroscope = sg.wrap(async (args: GetHoroscopeInput) => {
  if (!args.sign) throw new Error('sign is required (e.g. aries, taurus)')
  const sign = args.sign.toLowerCase().trim()
  if (!SIGNS.includes(sign)) throw new Error(`Invalid sign. Valid: ${SIGNS.join(', ')}`)
  const day = args.day || 'TODAY'
  const res = await fetch(`${API_BASE}?sign=${sign}&day=${day}`, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Horoscope API ${res.status}`)
  return await res.json()
}, { method: 'get_horoscope' })

const getAllSigns = sg.wrap(async () => {
  return { count: SIGN_DATA.length, signs: SIGN_DATA }
}, { method: 'get_all_signs' })

export { getHoroscope, getAllSigns }

console.log('settlegrid-horoscope MCP server ready')
console.log('Methods: get_horoscope, get_all_signs')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
