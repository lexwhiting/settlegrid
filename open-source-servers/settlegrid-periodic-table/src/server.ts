/**
 * settlegrid-periodic-table — Periodic Table MCP Server
 *
 * Wraps a free Periodic Table API with SettleGrid billing.
 * No API key needed.
 *
 * Methods:
 *   get_element(query)        — Element details by name/symbol/number  (1¢)
 *   list_elements(category?)  — List or filter elements                (1¢)
 */

import { settlegrid } from '@settlegrid/mcp'

// ─── Types ──────────────────────────────────────────────────────────────────

interface GetElementInput { query: string }
interface ListInput { category?: string }

interface Element {
  name: string
  symbol: string
  atomicNumber: number
  atomicMass: string
  groupBlock: string
  standardState: string
  electronicConfiguration: string
  yearDiscovered: string
  meltingPoint?: number
  boilingPoint?: number
  density?: number
  oxidationStates?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API_BASE = 'https://neelpatel05.pythonanywhere.com'

async function periodicFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) {
    if (res.status === 404) throw new Error('Element not found')
    const body = await res.text().catch(() => '')
    throw new Error(`Periodic Table API ${res.status}: ${body.slice(0, 200)}`)
  }
  return res.json() as Promise<T>
}

function formatElement(e: Record<string, unknown>) {
  return {
    name: e.name as string,
    symbol: e.symbol as string,
    atomicNumber: e.atomicNumber as number,
    atomicMass: e.atomicMass as string,
    groupBlock: e.groupBlock as string,
    standardState: e.standardState as string || 'unknown',
    electronicConfiguration: e.electronicConfiguration as string,
    yearDiscovered: e.yearDiscovered as string,
    meltingPoint: (e.meltingPoint as number) || null,
    boilingPoint: (e.boilingPoint as number) || null,
    density: (e.density as number) || null,
    oxidationStates: (e.oxidationStates as string) || null,
  }
}

// ─── SettleGrid Init ────────────────────────────────────────────────────────

const sg = settlegrid.init({
  toolSlug: 'periodic-table',
  pricing: {
    defaultCostCents: 1,
    methods: {
      get_element: { costCents: 1, displayName: 'Get Element' },
      list_elements: { costCents: 1, displayName: 'List Elements' },
    },
  },
})

// ─── Handlers ───────────────────────────────────────────────────────────────

const getElement = sg.wrap(async (args: GetElementInput) => {
  if (!args.query || typeof args.query !== 'string') throw new Error('query is required')
  const q = args.query.trim()
  if (q.length === 0 || q.length > 30) throw new Error('query must be 1-30 characters')

  // Try atomic number first, then name
  const isNumber = /^\d+$/.test(q)
  if (isNumber) {
    const num = parseInt(q, 10)
    if (num < 1 || num > 118) throw new Error('Atomic number must be 1-118')
    const data = await periodicFetch<Record<string, unknown>>(`/atomicNumber/${num}`)
    return formatElement(data)
  }

  // Try as element name
  const capitalized = q.charAt(0).toUpperCase() + q.slice(1).toLowerCase()
  const data = await periodicFetch<Record<string, unknown>>(`/element/${encodeURIComponent(capitalized)}`)
  return formatElement(data)
}, { method: 'get_element' })

const listElements = sg.wrap(async (args: ListInput) => {
  const allData = await periodicFetch<Record<string, unknown>[]>('/')
  let elements = allData

  if (args.category && typeof args.category === 'string') {
    const cat = args.category.toLowerCase().trim()
    elements = allData.filter(e => {
      const group = ((e.groupBlock as string) || '').toLowerCase()
      return group.includes(cat)
    })
  }

  return {
    category: args.category || 'all',
    count: elements.length,
    elements: elements.map(e => ({
      name: e.name,
      symbol: e.symbol,
      atomicNumber: e.atomicNumber,
      groupBlock: e.groupBlock,
    })),
  }
}, { method: 'list_elements' })

// ─── Exports ────────────────────────────────────────────────────────────────

export { getElement, listElements }

console.log('settlegrid-periodic-table MCP server ready')
console.log('Methods: get_element, list_elements')
console.log('Pricing: 1¢ per call | Powered by SettleGrid')
