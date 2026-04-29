/**
 * settlegrid-neo4j-auradb — Neo4j AuraDB Query API MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

interface RunCypherInput {
  cypher: string
  parameters?: Record<string, unknown>
  database?: string
}

interface RunReadQueryInput {
  cypher: string
  parameters?: Record<string, unknown>
  database?: string
}

interface Neo4jQueryResponse {
  data?: {
    fields: string[]
    values: unknown[][]
  }
  errors?: Array<{ message: string; code: string }>
  notifications?: unknown[]
}

function getBearerToken(): string {
  const token = process.env.NEO4J_BEARER_TOKEN
  if (!token) throw new Error('NEO4J_BEARER_TOKEN environment variable is required')
  return token
}

function getAuraHost(): string {
  const host = process.env.NEO4J_AURA_HOST
  if (!host) throw new Error('NEO4J_AURA_HOST environment variable is required (e.g. https://<instance-id>.databases.neo4j.io)')
  return host.replace(/\/$/, '')
}

async function executeQuery(
  cypher: string,
  parameters: Record<string, unknown> = {},
  database: string = 'neo4j'
): Promise<Neo4jQueryResponse> {
  const token = getBearerToken()
  const host = getAuraHost()
  const url = `${host}/db/${encodeURIComponent(database)}/query/v2`

  const body = JSON.stringify({
    statement: cypher,
    parameters,
  })

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'settlegrid-neo4j-auradb/1.0',
    },
    body,
  })

  const text = await res.text()
  let json: Neo4jQueryResponse
  try {
    json = JSON.parse(text) as Neo4jQueryResponse
  } catch {
    throw new Error(`Neo4j API returned non-JSON (status ${res.status}): ${text.slice(0, 300)}`)
  }

  if (!res.ok) {
    const errMsg = json.errors?.map(e => `${e.code}: ${e.message}`).join('; ') ||
      `Neo4j API error (status ${res.status})`
    throw new Error(errMsg)
  }

  if (json.errors && json.errors.length > 0) {
    const errMsg = json.errors.map(e => `${e.code}: ${e.message}`).join('; ')
    throw new Error(`Cypher error: ${errMsg}`)
  }

  return json
}

const sg = settlegrid.init({
  toolSlug: 'neo4j-auradb',
  pricing: {
    defaultCostCents: 2,
    methods: {
      run_cypher_query: { costCents: 3, displayName: 'Run Cypher Query' },
      run_read_query: { costCents: 2, displayName: 'Run Read Query' },
    },
  },
})

const runCypherQuery = sg.wrap(async (args: RunCypherInput) => {
  const cypher = args.cypher?.trim()
  if (!cypher) throw new Error('cypher is required')
  const database = args.database?.trim() || 'neo4j'
  const parameters = args.parameters || {}
  const result = await executeQuery(cypher, parameters, database)
  return {
    database,
    fields: result.data?.fields ?? [],
    rows: result.data?.values ?? [],
    rowCount: result.data?.values?.length ?? 0,
    notifications: result.notifications ?? [],
  }
}, { method: 'run_cypher_query' })

const runReadQuery = sg.wrap(async (args: RunReadQueryInput) => {
  const cypher = args.cypher?.trim()
  if (!cypher) throw new Error('cypher is required')
  const upperCypher = cypher.toUpperCase()
  const writeClauses = ['CREATE ', 'MERGE ', 'DELETE ', 'SET ', 'REMOVE ', 'DROP ', 'CALL {', 'CALL{']
  const hasWrite = writeClauses.some(c => upperCypher.includes(c))
  if (hasWrite) throw new Error('run_read_query only accepts read-only Cypher (no CREATE/MERGE/DELETE/SET/REMOVE/DROP)')
  const database = args.database?.trim() || 'neo4j'
  const parameters = args.parameters || {}
  const result = await executeQuery(cypher, parameters, database)
  return {
    database,
    fields: result.data?.fields ?? [],
    rows: result.data?.values ?? [],
    rowCount: result.data?.values?.length ?? 0,
    notifications: result.notifications ?? [],
  }
}, { method: 'run_read_query' })

export { runCypherQuery, runReadQuery }
console.log('settlegrid-neo4j-auradb MCP server ready')
console.log('Methods: run_cypher_query, run_read_query')
console.log('Pricing: 2-3¢ per call | Powered by SettleGrid')