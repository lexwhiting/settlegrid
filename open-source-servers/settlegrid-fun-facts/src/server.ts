/**
 * settlegrid-fun-facts — Random Fun Facts MCP Server
 *
 * Methods:
 *   get_random_fact()                (1¢)
 *   get_fact_of_day()                (1¢)
 *   get_math_fact(number)            (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface MathFactInput { number: number }

const USER_AGENT = 'settlegrid-fun-facts/1.0 (contact@settlegrid.ai)'

const sg = settlegrid.init({
  toolSlug: 'fun-facts',
  pricing: { defaultCostCents: 1, methods: {
    get_random_fact: { costCents: 1, displayName: 'Get random fun fact' },
    get_fact_of_day: { costCents: 1, displayName: 'Get fact of the day' },
    get_math_fact: { costCents: 1, displayName: 'Get math fact about a number' },
  }},
})

const getRandomFact = sg.wrap(async () => {
  const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/random?language=en', {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Facts API ${res.status}`)
  return await res.json()
}, { method: 'get_random_fact' })

const getFactOfDay = sg.wrap(async () => {
  const res = await fetch('https://uselessfacts.jsph.pl/api/v2/facts/today?language=en', {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Facts API ${res.status}`)
  return await res.json()
}, { method: 'get_fact_of_day' })

const getMathFact = sg.wrap(async (args: MathFactInput) => {
  if (args.number === undefined || typeof args.number !== 'number') throw new Error('number is required')
  const res = await fetch(`http://numbersapi.com/${args.number}/math?json`, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`Numbers API ${res.status}`)
  return await res.json()
}, { method: 'get_math_fact' })

export { getRandomFact, getFactOfDay, getMathFact }

console.log('settlegrid-fun-facts MCP server ready')
console.log('Methods: get_random_fact, get_fact_of_day, get_math_fact')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
