import { NextRequest } from 'next/server'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { z } from 'zod'

export const maxDuration = 60

const BASE_URL = 'https://settlegrid.ai'

/**
 * Allowed internal URL prefix for call_tool routing.
 * Prevents SSRF by only allowing internal API calls.
 */
const INTERNAL_SERVE_PREFIX = `${BASE_URL}/api/tools/serve/`
const INTERNAL_PROXY_PREFIX = `${BASE_URL}/api/proxy/`

/** Validate that a slug contains only safe characters */
const SAFE_SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,127}$/

/** Create a fresh MCP server per request (stateless mode) */
function createDiscoveryServer(apiKey: string | null): McpServer {
  const server = new McpServer({
    name: 'SettleGrid',
    version: '2.0.0',
  })

  // ── Existing Discovery Tools ──────────────────────────────────────────────

  server.registerTool('search_tools', {
    title: 'Search Tools',
    description:
      'Search the SettleGrid marketplace for AI tools by keyword, category, price, or rating. ' +
      'Returns tool names, slugs, descriptions, pricing, and developer info. ' +
      'Use this as your starting point to find tools for any task.',
    inputSchema: {
      query: z.string().optional().describe('Free-text search query (e.g. "weather", "translate", "sentiment")'),
      category: z.string().optional().describe('Filter by category slug (e.g. "data", "nlp", "finance"). Use list_categories to see all options.'),
      limit: z.number().min(1).max(100).default(20).describe('Maximum number of results to return (1-100, default 20)'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
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
    description:
      'Retrieve full details for a specific tool by its slug, including description, pricing breakdown, ' +
      'developer info, recent reviews, changelog history, and quick-start code snippets. ' +
      'Use after search_tools to get deeper information before deciding to invoke a tool.',
    inputSchema: {
      slug: z.string().min(1).max(128).describe('The unique slug of the tool (e.g. "wikipedia", "forex-rates", "dad-jokes")'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ slug }) => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/${encodeURIComponent(slug)}`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  server.registerTool('list_categories', {
    title: 'List Categories',
    description:
      'List all available tool categories on the SettleGrid marketplace with the number of tools in each. ' +
      'Use this to understand what types of tools are available before searching.',
    inputSchema: {},
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async () => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/categories`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  server.registerTool('get_developer', {
    title: 'Get Developer Profile',
    description:
      'Get a developer\'s public profile, bio, reputation score, and their published tools on SettleGrid. ' +
      'Useful for evaluating tool quality by checking the developer\'s track record.',
    inputSchema: {
      slug: z.string().min(1).max(128).describe('The developer\'s unique profile slug (returned by search_tools and get_tool)'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ slug }) => {
    const res = await fetch(`${BASE_URL}/api/v1/discover/developers/${encodeURIComponent(slug)}`)
    const data = await res.json()
    return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
  })

  // ── Meta-MCP: Call Any Marketplace Tool ───────────────────────────────────

  server.registerTool('call_tool', {
    title: 'Call Marketplace Tool',
    description:
      'Invoke any tool on the SettleGrid marketplace by its slug. Pass arguments as a JSON object. ' +
      'Free showcase tools work without an API key. Paid tools route through the Smart Proxy and ' +
      'require an API key (passed via the x-api-key header on the MCP connection). ' +
      'Use search_tools or list_marketplace_tools first to find the right tool and its slug.',
    inputSchema: {
      slug: z
        .string()
        .min(1)
        .max(128)
        .regex(/^[a-z0-9][a-z0-9._-]{0,127}$/, 'Slug must contain only lowercase letters, numbers, dots, hyphens, and underscores')
        .describe('Tool slug (e.g. "wikipedia", "dad-jokes", "forex-rates")'),
      method: z
        .string()
        .max(64)
        .optional()
        .describe('Specific method or action to call on the tool (e.g. "search", "get_random")'),
      args: z
        .record(z.unknown())
        .optional()
        .describe('Arguments to pass to the tool as a JSON object (e.g. { "query": "Einstein" })'),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
  }, async ({ slug, method, args }) => {
    // Validate slug to prevent path traversal / injection
    if (!SAFE_SLUG_RE.test(slug)) {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ error: 'Invalid tool slug format.' }),
        }],
        isError: true,
      }
    }

    const payload: Record<string, unknown> = { ...args }
    if (method) {
      payload.method = method
    }

    // If we have an API key, try the Smart Proxy first (supports billing)
    if (apiKey) {
      try {
        const proxyUrl = `${INTERNAL_PROXY_PREFIX}${encodeURIComponent(slug)}`
        const proxyRes = await fetch(proxyUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(30_000),
        })

        // If proxy returns success or a billing error, return that
        if (proxyRes.ok || proxyRes.status === 402) {
          const data = await proxyRes.json()
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(data, null, 2),
            }],
            ...(proxyRes.status === 402 ? { isError: true } : {}),
          }
        }

        // If tool has no proxy endpoint (404 NO_PROXY_ENDPOINT), fall through to serve
        const errorData = await proxyRes.json().catch(() => ({})) as Record<string, unknown>
        if (errorData.code === 'NO_PROXY_ENDPOINT') {
          // Fall through to serve endpoint below
        } else if (errorData.code === 'TOOL_MISMATCH') {
          // API key is for a different tool — fall through to serve
        } else {
          // Other proxy error (auth, rate limit, etc.)
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(errorData, null, 2),
            }],
            isError: true,
          }
        }
      } catch (err) {
        // Proxy fetch failed — fall through to serve
        const errorMsg = err instanceof Error ? err.message : 'Unknown error'
        if (errorMsg.includes('AbortError') || errorMsg.includes('timeout')) {
          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({ error: 'Tool call timed out after 30 seconds.' }),
            }],
            isError: true,
          }
        }
        // Fall through to serve endpoint
      }
    }

    // Fallback: try the internal serve endpoint (free showcase tools)
    try {
      const serveUrl = `${INTERNAL_SERVE_PREFIX}${encodeURIComponent(slug)}`
      const serveRes = await fetch(serveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15_000),
      })

      const data = await serveRes.json()
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(data, null, 2),
        }],
        ...(serveRes.ok ? {} : { isError: true }),
      }
    } catch {
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            error: `Tool "${slug}" is not available. Use search_tools to find available tools.`,
          }),
        }],
        isError: true,
      }
    }
  })

  // ── Meta-MCP: List Marketplace Tools ──────────────────────────────────────

  server.registerTool('list_marketplace_tools', {
    title: 'List Marketplace Tools',
    description:
      'Browse the most popular tools on the SettleGrid marketplace with pricing and availability info. ' +
      'Each result includes cost-per-call, total invocations, and whether the tool requires an API key. ' +
      'Optionally filter by category. Use this to find callable tools before invoking them with call_tool.',
    inputSchema: {
      category: z.string().optional().describe('Filter by category slug (e.g. "data", "nlp", "search", "finance")'),
      limit: z.number().min(1).max(50).default(20).describe('Maximum number of tools to return (1-50, default 20)'),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  }, async ({ category, limit }) => {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    params.set('limit', String(limit ?? 20))
    params.set('sort', 'popular')
    const res = await fetch(`${BASE_URL}/api/v1/discover?${params}`)
    const data = (await res.json()) as {
      tools?: Array<{
        slug: string
        name: string
        category: string
        description: string
        pricingConfig: Record<string, unknown>
        proxyEndpoint: string | null
        totalInvocations: number
      }>
    }

    // Enrich with pricing and availability
    const tools = (data.tools ?? []).map((tool) => {
      const config = tool.pricingConfig ?? {}
      const costCents = typeof config.defaultCostCents === 'number' ? config.defaultCostCents : 0
      return {
        slug: tool.slug,
        name: tool.name,
        category: tool.category,
        description: tool.description,
        costPerCall: costCents === 0 ? 'Free' : `$${(costCents / 100).toFixed(2)}`,
        costCents,
        hasProxyEndpoint: !!tool.proxyEndpoint,
        totalInvocations: tool.totalInvocations,
        callableVia: tool.proxyEndpoint ? 'proxy (API key required)' : 'serve (free)',
      }
    })

    return {
      content: [{
        type: 'text' as const,
        text: JSON.stringify({
          tools,
          total: tools.length,
          hint: 'Use call_tool with the slug to invoke a tool. Proxy tools require an API key.',
        }, null, 2),
      }],
    }
  })

  return server
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, mcp-session-id, Last-Event-ID, mcp-protocol-version, x-api-key',
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
  // Extract optional API key for billing through the Smart Proxy
  const apiKey = request.headers.get('x-api-key')

  const transport = new WebStandardStreamableHTTPServerTransport()
  const server = createDiscoveryServer(apiKey)
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
