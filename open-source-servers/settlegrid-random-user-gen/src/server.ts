/**
 * settlegrid-random-user-gen — Random User Generator MCP Server
 *
 * Wraps RandomUser.me API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   generate_users(count?, nationality?) — random users (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

interface UserInput { count?: number; nationality?: string }

const sg = settlegrid.init({
  toolSlug: 'random-user-gen',
  pricing: { defaultCostCents: 1, methods: { generate_users: { costCents: 1, displayName: 'Generate Users' } } },
})

const generateUsers = sg.wrap(async (args: UserInput) => {
  const count = Math.min(Math.max(args.count ?? 5, 1), 100)
  let url = `https://randomuser.me/api/?results=${count}`
  if (args.nationality) url += `&nat=${args.nationality}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`API ${res.status}`)
  const data = await res.json() as any
  return {
    users: (data.results || []).map((u: any) => ({
      name: `${u.name.first} ${u.name.last}`, email: u.email,
      gender: u.gender, phone: u.phone, cell: u.cell,
      city: u.location.city, state: u.location.state, country: u.location.country,
      postcode: u.location.postcode, age: u.dob.age,
      picture: u.picture.medium, username: u.login.username,
      nat: u.nat, uuid: u.login.uuid,
    })),
  }
}, { method: 'generate_users' })

export { generateUsers }

console.log('settlegrid-random-user-gen MCP server ready')
console.log('Methods: generate_users')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
