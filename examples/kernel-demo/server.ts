/**
 * Kernel demo — Hono server with @settlegrid/mcp dispatch kernel.
 *
 * Wraps a single `/search` endpoint in the kernel so that:
 *   - Requests without payment headers → 402 multi-protocol manifest
 *   - Requests with `x-api-key` (sg-balance) → validated + metered → 200
 *   - Requests with `payment-signature` (x402) → facilitator-verified → 200
 *
 * Run standalone:  npx tsx server.ts
 * Run via demo:    npm run dev
 */

import { Hono } from 'hono'
import { settlegrid, createDispatchKernel } from '@settlegrid/mcp'
import type { PaymentContext } from '@settlegrid/mcp'

const app = new Hono()

const sg = settlegrid.init({
  toolSlug: 'kernel-demo-search',
  pricing: { defaultCostCents: 5 },
  toolSecret: 'demo-tool-secret',
})

const kernel = createDispatchKernel(sg)

app.post('/search', async (c) => {
  const response = await kernel.handle(c.req.raw, async (ctx: PaymentContext) => {
    return {
      results: ['alpha', 'beta', 'gamma'],
      query: ctx.operation.method,
      protocol: ctx.protocol,
    }
  })
  return response
})

export { app }
export default app
