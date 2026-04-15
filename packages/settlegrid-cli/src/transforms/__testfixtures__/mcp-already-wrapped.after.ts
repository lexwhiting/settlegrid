import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: 'mcp-already',
  pricing: { defaultCostCents: 1 },
})

const server = new Server(
  { name: 'mcp-already', version: '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(
  ListToolsRequestSchema,
  sg.wrap(async () => ({ tools: [] }), { method: 'list-tools' }),
)

export { server }
