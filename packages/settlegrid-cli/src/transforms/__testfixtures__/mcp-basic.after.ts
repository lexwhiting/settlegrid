import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { settlegrid } from '@settlegrid/mcp';

const sg = settlegrid.init({
  toolSlug: 'mcp-basic',

  pricing: {
    defaultCostCents: 1
  }
});

const server = new Server(
  { name: 'mcp-basic', version: '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, sg.wrap(async () => {
  return { tools: [] }
}, {
  method: 'list-tools'
}))

server.setRequestHandler(CallToolRequestSchema, sg.wrap(async (req) => {
  return { content: [{ type: 'text', text: 'ok' }] }
}, {
  method: 'call-tool'
}))

export { server }
