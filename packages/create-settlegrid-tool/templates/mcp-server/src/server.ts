import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { settlegrid } from '@settlegrid/mcp'

// Initialize SettleGrid billing
const sg = settlegrid.init({
  toolSlug: '{{TOOL_SLUG}}', // Replace with your registered slug from settlegrid.ai
  pricing: {
    defaultCostCents: {{PRICE_CENTS}},
    methods: {
      'query': { costCents: {{PRICE_CENTS}}, displayName: 'Query' },
    },
  },
})

// Wrap your tool handler with SettleGrid billing
const query = sg.wrap(
  async (args: { query: string }) => {
    // TODO: Implement your tool logic here
    return { result: `Response for: ${args.query}` }
  },
  { method: 'query' }
)

// Create the MCP server
const server = new McpServer({
  name: '{{TOOL_SLUG}}',
  version: '1.0.0',
})

// Register tools
server.tool(
  'query',
  'Run a query against {{TOOL_NAME}}',
  {
    query: z.string().describe('The query to run'),
  },
  async ({ query: queryText }) => {
    const result = await query({ query: queryText })
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  }
)

// Start the server with stdio transport
async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('Server error:', error)
  process.exit(1)
})
