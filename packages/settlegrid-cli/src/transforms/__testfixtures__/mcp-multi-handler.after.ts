import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

import { settlegrid } from '@settlegrid/mcp';

const sg = settlegrid.init({
  toolSlug: 'mcp-multi-handler',

  pricing: {
    defaultCostCents: 1
  }
});

const server = new Server(
  { name: 'mcp-multi', version: '0.0.0' },
  { capabilities: { tools: {}, resources: {} } },
)

server.setRequestHandler(ListToolsRequestSchema, sg.wrap(async () => ({ tools: [] }), {
  method: 'list-tools'
}))
server.setRequestHandler(CallToolRequestSchema, sg.wrap(async (req) => {
  return { content: [{ type: 'text', text: 'call' }] }
}, {
  method: 'call-tool'
}))
server.setRequestHandler(ListResourcesRequestSchema, sg.wrap(async () => ({ resources: [] }), {
  method: 'list-resources'
}))
server.setRequestHandler(ReadResourceRequestSchema, sg.wrap(async (req) => ({ contents: [] }), {
  method: 'read-resource'
}))

export { server }
