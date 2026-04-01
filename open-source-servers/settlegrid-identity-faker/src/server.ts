/**
 * settlegrid-identity-faker — Test Identity Generator MCP Server
 *
 * Generates realistic fake identities for testing purposes.
 * All data is randomly generated — not real people.
 *
 * Methods:
 *   generate_identity(locale?)    — Generate fake identity          (1c)
 *   generate_company()            — Generate fake company           (1c)
 *   generate_credit_card()        — Generate fake card number       (1c)
 */

import { settlegrid } from '@settlegrid/mcp'

interface GenIdentityInput { locale?: string; count?: number }

const FIRST_NAMES_M = ['James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Daniel', 'Liam', 'Noah', 'Oliver', 'Elijah', 'Lucas']
const FIRST_NAMES_F = ['Mary', 'Patricia', 'Jennifer', 'Linda', 'Barbara', 'Elizabeth', 'Susan', 'Jessica', 'Sarah', 'Karen', 'Emma', 'Olivia', 'Ava', 'Isabella', 'Sophia']
const LAST_NAMES = ['Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis', 'Rodriguez', 'Martinez', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore']
const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'protonmail.com']
const STREETS = ['Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr', 'Pine St', 'Washington Ave']
const COMPANY_SUFFIXES = ['Inc', 'LLC', 'Corp', 'Solutions', 'Systems', 'Technologies', 'Group', 'Labs', 'Digital', 'Partners']
const COMPANY_PREFIXES = ['Global', 'Advanced', 'Dynamic', 'Unified', 'Prime', 'Apex', 'Vertex', 'Nexus', 'Core', 'Quantum']
const INDUSTRIES = ['Technology', 'Finance', 'Healthcare', 'Education', 'Manufacturing', 'Consulting', 'Retail', 'Energy']

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }
function randInt(min: number, max: number): number { return Math.floor(Math.random() * (max - min + 1)) + min }

const sg = settlegrid.init({
  toolSlug: 'identity-faker',
  pricing: { defaultCostCents: 1, methods: {
    generate_identity: { costCents: 1, displayName: 'Generate Identity' },
    generate_company: { costCents: 1, displayName: 'Generate Company' },
    generate_credit_card: { costCents: 1, displayName: 'Generate Credit Card' },
  }},
})

const generateIdentity = sg.wrap(async (args: GenIdentityInput) => {
  const count = Math.min(args.count ?? 1, 10)
  const identities = Array.from({ length: count }, () => {
    const isMale = Math.random() > 0.5
    const first = pick(isMale ? FIRST_NAMES_M : FIRST_NAMES_F)
    const last = pick(LAST_NAMES)
    const age = randInt(18, 85)
    const birthYear = new Date().getFullYear() - age
    const month = String(randInt(1, 12)).padStart(2, '0')
    const day = String(randInt(1, 28)).padStart(2, '0')
    return {
      name: { first, last, full: `${first} ${last}` },
      gender: isMale ? 'male' : 'female',
      age,
      date_of_birth: `${birthYear}-${month}-${day}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${randInt(1, 999)}@${pick(DOMAINS)}`,
      phone: `+1-${randInt(200, 999)}-${randInt(200, 999)}-${String(randInt(1000, 9999))}`,
      address: { street: `${randInt(1, 9999)} ${pick(STREETS)}`, city: pick(['Springfield', 'Portland', 'Franklin', 'Clinton', 'Madison']), state: pick(['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH']), zip: String(randInt(10000, 99999)) },
      ssn_format: `XXX-XX-${String(randInt(1000, 9999))}`,
    }
  })
  return { identities, count, disclaimer: 'FAKE DATA for testing only. Not real people.' }
}, { method: 'generate_identity' })

const generateCompany = sg.wrap(async (_a: Record<string, never>) => {
  const name = `${pick(COMPANY_PREFIXES)} ${pick(LAST_NAMES)} ${pick(COMPANY_SUFFIXES)}`
  return {
    name, industry: pick(INDUSTRIES), founded: randInt(1950, 2023),
    employees: randInt(10, 50000), revenue_million_usd: randInt(1, 5000),
    ceo: `${pick(FIRST_NAMES_M)} ${pick(LAST_NAMES)}`,
    website: `https://www.${name.toLowerCase().replace(/ /g, '')}.com`,
    ein: `${randInt(10, 99)}-${String(randInt(1000000, 9999999))}`,
    disclaimer: 'FAKE DATA for testing only.',
  }
}, { method: 'generate_company' })

const generateCreditCard = sg.wrap(async (_a: Record<string, never>) => {
  const types = [
    { name: 'Visa', prefix: '4', length: 16 },
    { name: 'Mastercard', prefix: '5' + String(randInt(1, 5)), length: 16 },
    { name: 'Amex', prefix: '3' + pick(['4', '7']), length: 15 },
  ]
  const type = pick(types)
  let num = type.prefix
  while (num.length < type.length - 1) num += String(randInt(0, 9))
  // Luhn check digit
  const digits = num.split('').map(Number).reverse()
  let sum = 0
  for (let i = 0; i < digits.length; i++) {
    let d = digits[i]
    if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9 }
    sum += d
  }
  num += String((10 - (sum % 10)) % 10)
  const exp = `${String(randInt(1, 12)).padStart(2, '0')}/${randInt(25, 30)}`
  return { type: type.name, number: num, expiry: exp, cvv: String(randInt(100, 999)), disclaimer: 'FAKE — not a real card number (Luhn-valid for testing)' }
}, { method: 'generate_credit_card' })

export { generateIdentity, generateCompany, generateCreditCard }
console.log('settlegrid-identity-faker MCP server ready')
console.log('Methods: generate_identity, generate_company, generate_credit_card')
console.log('Pricing: 1c per call | Powered by SettleGrid')
