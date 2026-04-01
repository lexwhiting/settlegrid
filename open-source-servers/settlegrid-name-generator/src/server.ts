/**
 * settlegrid-name-generator — Name Generator MCP Server
 *
 * Name Generator tools with SettleGrid billing.
 *
 * Pricing: 1-2c per call | Powered by SettleGrid
 */

import { settlegrid } from '@settlegrid/mcp'

const FIRST_M = ['James','John','Robert','Michael','William','David','Richard','Thomas','Daniel','Matthew','Liam','Noah','Oliver','Elijah','Lucas','Alexander','Sebastian','Benjamin','Henry','Theodore']
const FIRST_F = ['Mary','Emma','Olivia','Ava','Sophia','Isabella','Mia','Charlotte','Amelia','Harper','Evelyn','Abigail','Emily','Luna','Camila','Aria','Scarlett','Penelope','Layla','Chloe']
const LAST = ['Smith','Johnson','Williams','Brown','Jones','Garcia','Miller','Davis','Rodriguez','Martinez','Wilson','Anderson','Taylor','Thomas','Moore','Jackson','White','Harris','Martin','Thompson','Young','Allen','King','Wright','Scott','Green','Baker','Adams','Nelson','Hill','Ramirez','Campbell','Mitchell','Roberts','Carter','Phillips','Evans','Turner','Torres','Parker','Collins','Edwards','Stewart','Morris','Murphy','Rivera','Cook','Rogers','Morgan','Peterson','Cooper','Reed','Bailey','Bell','Howard','Ward','Cox','Price','Bennett','Wood','Barnes','Ross']
def pick_fn():
    return "arr[Math.floor(Math.random() * arr.length)]"

const sg = settlegrid.init({
  toolSlug: 'name-generator',
  pricing: { defaultCostCents: 1, methods: {
    generate_name: { costCents: 1, displayName: 'Generate Name' },
    generate_username: { costCents: 1, displayName: 'Generate Username' },
  }},
})

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

const generateName = sg.wrap(async (args: { gender?: string; count?: number }) => {
  const count = Math.min(args.count ?? 1, 20)
  const names = Array.from({ length: count }, () => {
    const isMale = args.gender ? args.gender.toLowerCase() === 'male' : Math.random() > 0.5
    const first = pick(isMale ? FIRST_M : FIRST_F)
    const last = pick(LAST)
    return { first, last, full: `${first} ${last}`, gender: isMale ? 'male' : 'female' }
  })
  return { names, count, disclaimer: 'Randomly generated names' }
}, { method: 'generate_name' })

const generateUsername = sg.wrap(async (args: { count?: number; style?: string }) => {
  const count = Math.min(args.count ?? 5, 20)
  const adjectives = ['swift','brave','dark','bright','cool','wild','epic','silent','quick','clever']
  const nouns = ['wolf','hawk','fox','bear','lion','tiger','eagle','phoenix','dragon','knight']
  const usernames = Array.from({ length: count }, () => {
    const style = (args.style ?? 'adjective_noun').toLowerCase()
    if (style === 'gamer') return `${pick(adjectives)}${pick(nouns)}${Math.floor(Math.random() * 999)}`
    return `${pick(adjectives)}_${pick(nouns)}${Math.floor(Math.random() * 99)}`
  })
  return { usernames, count }
}, { method: 'generate_username' })

export { generateName, generateUsername }
console.log('settlegrid-name-generator MCP server ready | Powered by SettleGrid')
