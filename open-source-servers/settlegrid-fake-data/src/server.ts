/**
 * settlegrid-fake-data — Fake Data Generator MCP Server
 *
 * Local generation — no external API needed.
 *
 * Methods:
 *   person()    — Generate a fake person     (1¢)
 *   company()   — Generate a fake company    (1¢)
 *   address()   — Generate a fake address    (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Data Sets ──────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'James', 'Mary', 'Robert', 'Patricia', 'John', 'Jennifer', 'Michael', 'Linda',
  'David', 'Elizabeth', 'William', 'Barbara', 'Richard', 'Susan', 'Joseph', 'Jessica',
  'Thomas', 'Sarah', 'Christopher', 'Karen', 'Daniel', 'Lisa', 'Matthew', 'Nancy',
  'Anthony', 'Betty', 'Mark', 'Margaret', 'Donald', 'Sandra', 'Steven', 'Ashley',
  'Andrew', 'Dorothy', 'Paul', 'Kimberly', 'Joshua', 'Emily', 'Kenneth', 'Donna',
]

const LAST_NAMES = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Garcia', 'Miller', 'Davis',
  'Rodriguez', 'Martinez', 'Hernandez', 'Lopez', 'Gonzalez', 'Wilson', 'Anderson',
  'Thomas', 'Taylor', 'Moore', 'Jackson', 'Martin', 'Lee', 'Perez', 'Thompson',
  'White', 'Harris', 'Sanchez', 'Clark', 'Ramirez', 'Lewis', 'Robinson',
]

const DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'protonmail.com', 'icloud.com']

const COMPANY_PREFIXES = ['Global', 'National', 'Premier', 'Advanced', 'Digital', 'Pacific', 'Atlas', 'Nexus', 'Pinnacle', 'Summit']
const COMPANY_SUFFIXES = ['Solutions', 'Technologies', 'Systems', 'Group', 'Industries', 'Consulting', 'Partners', 'Labs', 'Dynamics', 'Ventures']
const INDUSTRIES = ['Technology', 'Healthcare', 'Finance', 'Education', 'Manufacturing', 'Retail', 'Energy', 'Real Estate', 'Transportation', 'Media']

const STREETS = ['Main St', 'Oak Ave', 'Elm St', 'Park Blvd', 'Cedar Ln', 'Maple Dr', 'Pine Rd', 'Washington St', 'Lake View Dr', 'Sunset Blvd']
const CITIES = ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'Philadelphia', 'San Antonio', 'San Diego', 'Dallas', 'Austin']
const STATES = ['NY', 'CA', 'IL', 'TX', 'AZ', 'PA', 'FL', 'OH', 'GA', 'NC']

// ─── Helpers ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function randPhone(): string {
  return `+1${randInt(200, 999)}${randInt(100, 999)}${randInt(1000, 9999)}`
}

function randDate(startYear: number, endYear: number): string {
  const year = randInt(startYear, endYear)
  const month = String(randInt(1, 12)).padStart(2, '0')
  const day = String(randInt(1, 28)).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'fake-data',
  pricing: {
    defaultCostCents: 1,
    methods: {
      person: { costCents: 1, displayName: 'Fake Person' },
      company: { costCents: 1, displayName: 'Fake Company' },
      address: { costCents: 1, displayName: 'Fake Address' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const person = sg.wrap(async () => {
  const firstName = pick(FIRST_NAMES)
  const lastName = pick(LAST_NAMES)
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${randInt(1, 999)}@${pick(DOMAINS)}`

  return {
    firstName,
    lastName,
    fullName: `${firstName} ${lastName}`,
    email,
    phone: randPhone(),
    dateOfBirth: randDate(1950, 2005),
    age: randInt(18, 75),
    gender: Math.random() > 0.5 ? 'male' : 'female',
    username: `${firstName.toLowerCase()}${lastName.toLowerCase()}${randInt(1, 99)}`,
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${firstName}+${lastName}`,
  }
}, { method: 'person' })

const company = sg.wrap(async () => {
  const name = `${pick(COMPANY_PREFIXES)} ${pick(COMPANY_SUFFIXES)}`
  const industry = pick(INDUSTRIES)
  const domain = name.toLowerCase().replace(/\s+/g, '') + '.com'

  return {
    name,
    industry,
    domain,
    email: `info@${domain}`,
    phone: randPhone(),
    founded: randInt(1950, 2023),
    employees: randInt(10, 50000),
    revenue: `$${randInt(1, 500)}M`,
    ceo: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
    headquarters: `${pick(CITIES)}, ${pick(STATES)}`,
    description: `${name} is a leading ${industry.toLowerCase()} company providing innovative solutions.`,
  }
}, { method: 'company' })

const address = sg.wrap(async () => {
  const stateIdx = randInt(0, STATES.length - 1)

  return {
    street: `${randInt(100, 9999)} ${pick(STREETS)}`,
    apartment: Math.random() > 0.7 ? `Apt ${randInt(1, 500)}` : null,
    city: CITIES[stateIdx] || pick(CITIES),
    state: STATES[stateIdx],
    zipCode: String(randInt(10000, 99999)),
    country: 'United States',
    countryCode: 'US',
    latitude: Math.round((randInt(25, 48) + Math.random()) * 10000) / 10000,
    longitude: Math.round((-randInt(70, 122) + Math.random()) * 10000) / 10000,
  }
}, { method: 'address' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { person, company, address }

console.log('settlegrid-fake-data MCP server ready')
console.log('Methods: person, company, address')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
