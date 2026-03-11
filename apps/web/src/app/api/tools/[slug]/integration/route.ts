import { NextRequest } from 'next/server'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tools } from '@/lib/db/schema'
import { successResponse, errorResponse, internalErrorResponse } from '@/lib/api'
import { apiLimiter, checkRateLimit } from '@/lib/rate-limit'

export const maxDuration = 10

interface IntegrationTemplate {
  client: string
  config: string
  instructions: string
}

function generateTemplates(toolSlug: string, toolName: string): IntegrationTemplate[] {
  return [
    {
      client: 'Claude Desktop',
      config: JSON.stringify({
        mcpServers: {
          [toolSlug]: {
            command: 'npx',
            args: ['-y', '@settlegrid/mcp-client'],
            env: {
              SETTLEGRID_API_KEY: '<YOUR_API_KEY>',
              SETTLEGRID_TOOL_SLUG: toolSlug,
            },
          },
        },
      }, null, 2),
      instructions: `1. Open Claude Desktop settings (claude_desktop_config.json)\n2. Add the MCP server configuration above\n3. Replace <YOUR_API_KEY> with your SettleGrid API key\n4. Restart Claude Desktop\n5. ${toolName} will be available as an MCP tool`,
    },
    {
      client: 'Cursor',
      config: JSON.stringify({
        'mcp.servers': {
          [toolSlug]: {
            command: 'npx',
            args: ['-y', '@settlegrid/mcp-client'],
            env: {
              SETTLEGRID_API_KEY: '<YOUR_API_KEY>',
              SETTLEGRID_TOOL_SLUG: toolSlug,
            },
          },
        },
      }, null, 2),
      instructions: `1. Open Cursor settings (Settings > MCP Servers)\n2. Add the configuration above\n3. Replace <YOUR_API_KEY> with your SettleGrid API key\n4. Reload window\n5. ${toolName} will appear in your MCP tools`,
    },
    {
      client: 'Windsurf',
      config: JSON.stringify({
        mcpServers: {
          [toolSlug]: {
            command: 'npx',
            args: ['-y', '@settlegrid/mcp-client'],
            env: {
              SETTLEGRID_API_KEY: '<YOUR_API_KEY>',
              SETTLEGRID_TOOL_SLUG: toolSlug,
            },
          },
        },
      }, null, 2),
      instructions: `1. Open Windsurf MCP configuration\n2. Add the server configuration above\n3. Replace <YOUR_API_KEY> with your SettleGrid API key\n4. Restart Windsurf\n5. ${toolName} will be available as an MCP tool`,
    },
    {
      client: 'VS Code Copilot',
      config: `// .vscode/settings.json\n${JSON.stringify({
        'mcp.servers': {
          [toolSlug]: {
            command: 'npx',
            args: ['-y', '@settlegrid/mcp-client'],
            env: {
              SETTLEGRID_API_KEY: '<YOUR_API_KEY>',
              SETTLEGRID_TOOL_SLUG: toolSlug,
            },
          },
        },
      }, null, 2)}`,
      instructions: `1. Open VS Code settings (.vscode/settings.json)\n2. Add the MCP server configuration above\n3. Replace <YOUR_API_KEY> with your SettleGrid API key\n4. Reload VS Code window\n5. ${toolName} will be available via GitHub Copilot MCP`,
    },
    {
      client: 'Continue',
      config: JSON.stringify({
        experimental: {
          mcpServers: {
            [toolSlug]: {
              command: 'npx',
              args: ['-y', '@settlegrid/mcp-client'],
              env: {
                SETTLEGRID_API_KEY: '<YOUR_API_KEY>',
                SETTLEGRID_TOOL_SLUG: toolSlug,
              },
            },
          },
        },
      }, null, 2),
      instructions: `1. Open Continue configuration (~/.continue/config.json)\n2. Add the MCP server configuration above\n3. Replace <YOUR_API_KEY> with your SettleGrid API key\n4. Restart Continue\n5. ${toolName} will be available as an MCP tool`,
    },
  ]
}

/** GET /api/tools/[slug]/integration — public integration templates for AI clients */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
    const rl = await checkRateLimit(apiLimiter, `tool-integration:${ip}`)
    if (!rl.success) return errorResponse('Too many requests.', 429, 'RATE_LIMIT_EXCEEDED')

    const { slug } = await params

    const [tool] = await db
      .select({ id: tools.id, name: tools.name, slug: tools.slug })
      .from(tools)
      .where(and(eq(tools.slug, slug), eq(tools.status, 'active')))
      .limit(1)

    if (!tool) {
      return errorResponse('Tool not found.', 404, 'NOT_FOUND')
    }

    const templates = generateTemplates(tool.slug, tool.name)

    return successResponse({ tool: { name: tool.name, slug: tool.slug }, templates })
  } catch (error) {
    return internalErrorResponse(error)
  }
}
