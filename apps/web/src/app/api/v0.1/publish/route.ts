import { mcpErrorResponse, mcpOptionsResponse } from '@/lib/mcp-registry/helpers'

export const maxDuration = 5

/**
 * POST /api/v0.1/publish — Publish is not supported via the API.
 *
 * Returns 501 Not Implemented with guidance to use the dashboard.
 */
export function POST() {
  return mcpErrorResponse(
    'Publishing via the registry API is not supported. Use the SettleGrid Developer Dashboard at https://settlegrid.ai/dashboard to publish and manage your MCP servers.',
    501,
    'NOT_IMPLEMENTED',
  )
}

export function GET() {
  return mcpErrorResponse(
    'Method not allowed. POST is the only supported method for /publish (returns 501).',
    405,
    'METHOD_NOT_ALLOWED',
  )
}

export function PUT() {
  return mcpErrorResponse(
    'Method not allowed. POST is the only supported method for /publish (returns 501).',
    405,
    'METHOD_NOT_ALLOWED',
  )
}

export function DELETE() {
  return mcpErrorResponse(
    'Method not allowed. POST is the only supported method for /publish (returns 501).',
    405,
    'METHOD_NOT_ALLOWED',
  )
}

export function OPTIONS() {
  return mcpOptionsResponse()
}
