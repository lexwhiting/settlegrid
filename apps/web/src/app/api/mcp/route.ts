import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'

export const maxDuration = 60

const BASE_URL = 'https://settlegrid.ai'

/** Create a fresh MCP server per request (stateless mode) */
function createDiscoveryServer(): McpServer {
  const server = new McpServer({
    name: 'SettleGrid Discovery',
    version: '1.0.0',
  })

  server.registerTool('search_tools', {
    title: 'Search Tools',
    description: 'Search for monetized AI tools on SettleGrid',
    inputSchema: {
      query: z.string().optional().describe('Search query'),
      category: z.string().optional().describe('Filter by category'),
      limit: z.number().min(1).max(100).default(20).describe('Max results'),
    },
  }, async ({ query, category, limit }) => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category) params.set('category', category)
    params.set('limit', String(limit ?? 20))
    const res = await fetch(`${BASE_URL}/api/v1/discover?${params}`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  server.registerTool('get_tool', {
    title: 'Get Tool Details',
    description: 'Get full details for a specific tool by slug',
    inputSchema: {
      slug: z.string().describe('Tool slug'),
    },
  }, async ({ slug }) => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/${encodeURIComponent(slug)}`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  server.registerTool('list_categories', {
    title: 'List Categories',
    description: 'List all tool categories with counts',
    inputSchema: {},
  }, async () => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/categories`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  server.registerTool('get_developer', {
    title: 'Get Developer Profile',
    description: 'Get a developer profile and their published tools',
    inputSchema: {
      slug: z.string().describe('Developer slug'),
    },
  }, async ({ slug }) => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/developers/${encodeURIComponent(slug)}`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  return server
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version',
  'Access-Control-Expose-Headers': 'mcp-session-id, mcp-protocol-version',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  return handleMcp(request)
}

export async function POST(request: NextRequest) {
  return handleMcp(request)
}

export async function DELETE(request: NextRequest) {
  return handleMcp(request)
}

async function handleMcp(request: NextRequest): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport()
  const server = createDiscoveryServer()
  await server.connect(transport)
  const response = await transport.handleRequest(request as unknown as Request)

  // Add CORS headers
  const headers = new Headers(response.headers)
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value)
  }

  return new Response(response.body, {
    status: response.status,
    headers,
  })
}
