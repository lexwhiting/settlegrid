/**
 * MCP Wrapper Template for Alerterra Tools
 *
 * This template shows how to wrap any Alerterra API endpoint
 * as a SettleGrid-monetized MCP tool.
 *
 * Usage:
 * 1. Copy this template
 * 2. Replace TOOL_SLUG, TOOL_PRICING, and the handler logic
 * 3. Deploy alongside the Alerterra product
 * 4. The tool will appear in the SettleGrid showcase
 */

import { settlegrid } from '@settlegrid/mcp'

// Initialize SettleGrid with your tool config
const sg = settlegrid.init({
  toolSlug: 'TOOL_SLUG', // e.g., 'scrutera-sanctions'
  pricing: {
    defaultCostCents: 5,
    methods: {
      'screen': 5,
      'batch': 25,
    },
  },
})

// Example: Wrap a sanctions screening function
async function sanctionsScreenHandler(args: {
  query: string
  threshold?: number
}) {
  // Call the underlying Alerterra API
  const response = await fetch('https://scrutera.com/api/screen', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  return response.json()
}

// Wrap with SettleGrid billing
export const billedScreen = sg.wrap(sanctionsScreenHandler, { method: 'screen' })

// For Express/Next.js REST endpoint:
// import { settlegridMiddleware } from '@settlegrid/mcp/rest'
// app.post('/api/screen', settlegridMiddleware({ toolSlug: 'scrutera-sanctions', pricing: { defaultCostCents: 5 } }), handler)
