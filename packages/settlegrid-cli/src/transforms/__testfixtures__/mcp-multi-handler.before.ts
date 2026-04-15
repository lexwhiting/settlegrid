import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
  { name: 'mcp-multi', version: '0.0.0' },
  { capabilities: { tools: {}, resources: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: [] }))
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  return { content: [{ type: 'text', text: 'call' }] }
})
server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }))
server.setRequestHandler(ReadResourceRequestSchema, async (req) => ({ contents: [] }))

export { server }
