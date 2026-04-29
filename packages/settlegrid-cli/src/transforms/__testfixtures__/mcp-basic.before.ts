import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'mcp-basic', version: '0.0.0' },
  { capabilities: { tools: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: [] }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return { content: [{ type: 'text', text: 'ok' }] }
})

export { server }
