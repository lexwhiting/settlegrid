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

// ─── Standalone listener ──────────────────────────────────────────────────
//
// When this file is executed directly (`npx tsx server.ts` or `npm run dev`),
// start a Hono Node.js HTTP listener on port 3456 (or PORT env). When
// imported as a module (by client-test.ts or another consumer), the listener
// is NOT started — only the `app` export is used.
//
// Detection: Node sets `import.meta.url` to the file URL of the current
// module. `process.argv[1]` is the entry-point script path. If they match,
// we're the main module.

import { serve } from '@hono/node-server'
import { fileURLToPath } from 'node:url'

const isMainModule =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === process.argv[1]

if (isMainModule) {
  const port = Number(process.env.PORT) || 3456
  serve({ fetch: app.fetch, port }, () => {
    console.log(`SettleGrid kernel demo listening on http://localhost:${port}`)
    console.log('Try: curl -X POST http://localhost:' + port + '/search')
  })
}
