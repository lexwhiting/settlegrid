import { NextResponse } from 'next/server'

export const maxDuration = 5

export function GET() {
  return NextResponse.json({
    name: 'SettleGrid API',
    version: '1.0.0',
    documentation: 'https://settlegrid.ai/docs',
    openapi: 'https://settlegrid.ai/api/openapi.json',
    health: 'https://settlegrid.ai/api/health',
    support: 'mailto:support@settlegrid.ai',
    endpoints: {
      sdk: '/api/sdk/validate-key, /api/sdk/meter',
      x402: '/api/x402/verify, /api/x402/settle, /api/x402/supported',
      ap2: '/api/a2a, /api/a2a/skills',
      sessions: '/api/sessions',
      agents: '/api/agents',
      outcomes: '/api/outcomes',
      organizations: '/api/orgs',
      stream: '/api/stream',
    },
  })
}
