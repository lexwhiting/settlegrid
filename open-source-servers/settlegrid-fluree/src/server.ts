/**
 * settlegrid-fluree — Fluree Semantic Ledger MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://data.flur.ee'

interface CreateLedgerInput { ledger: string }
interface ListLedgersInput {}
interface QueryLedgerInput { ledger: string; query: string }
interface TransactLedgerInput { ledger: string; transaction: string }
interface QueryHistoryInput { ledger: string; query: string }
interface QuerySparqlInput { ledger: string; sparql: string }
interface DeleteLedgerInput { ledger: string }

function getApiKey(): string {
  const k = process.env.FLUREE_API_KEY
  if (!k) throw new Error('FLUREE_API_KEY environment variable is required')
  return k
}

async function flureeFetch(path: string, body: unknown): Promise<unknown> {
  const key = getApiKey()
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      'User-Agent': 'settlegrid-fluree/1.0',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Fluree API ${res.status}: ${text.slice(0, 300)}`)
  }
  return res.json()
}

const sg = settlegrid.init({
  toolSlug: 'fluree',
  pricing: {
    defaultCostCents: 2,
    methods: {
      create_ledger:  { costCents: 3, displayName: 'Create Ledger' },
      list_ledgers:   { costCents: 1, displayName: 'List Ledgers' },
      query_ledger:   { costCents: 2, displayName: 'Query Ledger' },
      transact_ledger:{ costCents: 4, displayName: 'Transact Ledger' },
      query_history:  { costCents: 2, displayName: 'Query History' },
      query_sparql:   { costCents: 2, displayName: 'Query SPARQL' },
      delete_ledger:  { costCents: 5, displayName: 'Delete Ledger' },
    },
  },
})

const createLedger = sg.wrap(async (args: CreateLedgerInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  return flureeFetch('/fluree/create', { ledger })
}, { method: 'create_ledger' })

const listLedgers = sg.wrap(async (_args: ListLedgersInput) => {
  return flureeFetch('/fluree/list', {})
}, { method: 'list_ledgers' })

const queryLedger = sg.wrap(async (args: QueryLedgerInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  const queryStr = args.query?.trim()
  if (!queryStr) throw new Error('query is required')
  let parsedQuery: unknown
  try {
    parsedQuery = JSON.parse(queryStr)
  } catch {
    throw new Error('query must be a valid JSON string')
  }
  return flureeFetch('/fluree/query', { ledger, ...( typeof parsedQuery === 'object' && parsedQuery !== null ? parsedQuery as Record<string, unknown> : { query: parsedQuery } ) })
}, { method: 'query_ledger' })

const transactLedger = sg.wrap(async (args: TransactLedgerInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  const txStr = args.transaction?.trim()
  if (!txStr) throw new Error('transaction is required')
  let parsedTx: unknown
  try {
    parsedTx = JSON.parse(txStr)
  } catch {
    throw new Error('transaction must be a valid JSON string')
  }
  return flureeFetch('/fluree/transact', { ledger, ...(typeof parsedTx === 'object' && parsedTx !== null && !Array.isArray(parsedTx) ? parsedTx as Record<string, unknown> : { insert: parsedTx }) })
}, { method: 'transact_ledger' })

const queryHistory = sg.wrap(async (args: QueryHistoryInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  const queryStr = args.query?.trim()
  if (!queryStr) throw new Error('query is required')
  let parsedQuery: unknown
  try {
    parsedQuery = JSON.parse(queryStr)
  } catch {
    throw new Error('query must be a valid JSON string')
  }
  return flureeFetch('/fluree/history', { ledger, ...(typeof parsedQuery === 'object' && parsedQuery !== null ? parsedQuery as Record<string, unknown> : { query: parsedQuery }) })
}, { method: 'query_history' })

const querySparql = sg.wrap(async (args: QuerySparqlInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  const sparql = args.sparql?.trim()
  if (!sparql) throw new Error('sparql is required')
  return flureeFetch('/fluree/sparql', { ledger, query: sparql })
}, { method: 'query_sparql' })

const deleteLedger = sg.wrap(async (args: DeleteLedgerInput) => {
  const ledger = args.ledger?.trim()
  if (!ledger) throw new Error('ledger is required')
  return flureeFetch('/fluree/delete', { ledger })
}, { method: 'delete_ledger' })

export { createLedger, listLedgers, queryLedger, transactLedger, queryHistory, querySparql, deleteLedger }
console.log('settlegrid-fluree MCP server ready')
console.log('Methods: create_ledger, list_ledgers, query_ledger, transact_ledger, query_history, query_sparql, delete_ledger')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')