/**
 * settlegrid-fivetran — Fivetran Connection Management MCP Server
 */
import { settlegrid } from '@settlegrid/mcp'

const BASE = 'https://api.fivetran.com'

interface ListConnectionsInput { limit?: number }
interface GetConnectionInput { connectionId: string }
interface TriggerSyncInput { connectionId: string }
interface TriggerResyncInput { connectionId: string }
interface GetConnectionSchemasInput { connectionId: string }
interface GetSchemaDetailsInput { connectionId: string; schemaName: string }
interface GetTableDetailsInput { connectionId: string; schemaName: string; tableName: string }
interface DeleteConnectionInput { connectionId: string }

function getCredentials(): string {
  const key = process.env.FIVETRAN_API_KEY
  if (!key) throw new Error('FIVETRAN_API_KEY environment variable is required')
  if (!key.includes(':')) throw new Error('FIVETRAN_API_KEY must be in the format "api_key:api_secret" for Basic auth')
  return Buffer.from(key).toString('base64')
}

async function apiFetch(
  path: string,
  options: { method?: string; body?: unknown } = {}
): Promise<unknown> {
  const encoded = getCredentials()
  const res = await fetch(`${BASE}${path}`, {
    method: options.method || 'GET',
    headers: {
      'Authorization': `Basic ${encoded}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'settlegrid-fivetran/1.0',
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  if (!res.ok) {
    const errText = (await res.text()).slice(0, 300)
    throw new Error(`Fivetran API ${res.status}: ${errText}`)
  }
  const text = await res.text()
  return text ? JSON.parse(text) : {}
}

const sg = settlegrid.init({
  toolSlug: 'fivetran',
  pricing: {
    defaultCostCents: 1,
    methods: {
      list_connections: { costCents: 1, displayName: 'List Connections' },
      get_connection: { costCents: 1, displayName: 'Get Connection' },
      trigger_sync: { costCents: 3, displayName: 'Trigger Sync' },
      trigger_resync: { costCents: 5, displayName: 'Trigger Resync' },
      get_connection_schemas: { costCents: 1, displayName: 'Get Connection Schemas' },
      get_schema_details: { costCents: 1, displayName: 'Get Schema Details' },
      get_table_details: { costCents: 1, displayName: 'Get Table Details' },
      delete_connection: { costCents: 5, displayName: 'Delete Connection' },
    },
  },
})

const listConnections = sg.wrap(async (args: ListConnectionsInput) => {
  const limit = Math.min(args.limit || 20, 50)
  const data = await apiFetch(`/v1/connections?limit=${limit}`) as { data: { items: unknown[] } }
  const items = data?.data?.items ?? []
  return { count: items.length, connections: items }
}, { method: 'list_connections' })

const getConnection = sg.wrap(async (args: GetConnectionInput) => {
  const id = args.connectionId?.trim()
  if (!id) throw new Error('connectionId is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}`)
}, { method: 'get_connection' })

const triggerSync = sg.wrap(async (args: TriggerSyncInput) => {
  const id = args.connectionId?.trim()
  if (!id) throw new Error('connectionId is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}/sync`, { method: 'POST', body: {} })
}, { method: 'trigger_sync' })

const triggerResync = sg.wrap(async (args: TriggerResyncInput) => {
  const id = args.connectionId?.trim()
  if (!id) throw new Error('connectionId is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}/resync`, { method: 'POST', body: {} })
}, { method: 'trigger_resync' })

const getConnectionSchemas = sg.wrap(async (args: GetConnectionSchemasInput) => {
  const id = args.connectionId?.trim()
  if (!id) throw new Error('connectionId is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}/schemas`)
}, { method: 'get_connection_schemas' })

const getSchemaDetails = sg.wrap(async (args: GetSchemaDetailsInput) => {
  const id = args.connectionId?.trim()
  const schema = args.schemaName?.trim()
  if (!id) throw new Error('connectionId is required')
  if (!schema) throw new Error('schemaName is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}/schemas/${encodeURIComponent(schema)}`)
}, { method: 'get_schema_details' })

const getTableDetails = sg.wrap(async (args: GetTableDetailsInput) => {
  const id = args.connectionId?.trim()
  const schema = args.schemaName?.trim()
  const table = args.tableName?.trim()
  if (!id) throw new Error('connectionId is required')
  if (!schema) throw new Error('schemaName is required')
  if (!table) throw new Error('tableName is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}/schemas/${encodeURIComponent(schema)}/tables/${encodeURIComponent(table)}`)
}, { method: 'get_table_details' })

const deleteConnection = sg.wrap(async (args: DeleteConnectionInput) => {
  const id = args.connectionId?.trim()
  if (!id) throw new Error('connectionId is required')
  return apiFetch(`/v1/connections/${encodeURIComponent(id)}`, { method: 'DELETE' })
}, { method: 'delete_connection' })

export {
  listConnections,
  getConnection,
  triggerSync,
  triggerResync,
  getConnectionSchemas,
  getSchemaDetails,
  getTableDetails,
  deleteConnection,
}
console.log('settlegrid-fivetran MCP server ready')
console.log('Methods: list_connections, get_connection, trigger_sync, trigger_resync, get_connection_schemas, get_schema_details, get_table_details, delete_connection')
console.log('Pricing: 1-5¢ per call | Powered by SettleGrid')