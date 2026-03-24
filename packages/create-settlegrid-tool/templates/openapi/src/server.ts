import express from 'express'
import { settlegrid } from '@settlegrid/mcp'

const app = express()
app.use(express.json())

const UPSTREAM_URL = process.env.UPSTREAM_API_URL || 'https://api.example.com'

const sg = settlegrid.init({
  toolSlug: '{{TOOL_SLUG}}', // Replace with your registered slug from settlegrid.ai
  pricing: {
    defaultCostCents: {{PRICE_CENTS}},
    methods: {
      // Add a method entry for each OpenAPI endpoint you want to monetize:
      // 'get-resource': { costCents: {{PRICE_CENTS}}, displayName: 'Get Resource' },
      // 'search': { costCents: {{PRICE_CENTS}}, displayName: 'Search' },
      // 'create-resource': { costCents: 5, displayName: 'Create Resource' },
    },
  },
})

// ------------------------------------------------------------------
// Add your OpenAPI endpoints below.
//
// For each endpoint in your OpenAPI spec, create a wrapped handler:
//
//   const getResource = sg.wrap(
//     async (args: { id: string }) => {
//       const res = await fetch(`${UPSTREAM_URL}/resources/${args.id}`, {
//         headers: { 'Authorization': `Bearer ${process.env.UPSTREAM_API_KEY}` },
//       })
//       if (!res.ok) throw new Error(`Upstream error: ${res.status}`)
//       return res.json()
//     },
//     { method: 'get-resource' }
//   )
//
//   app.get('/resources/:id', async (req, res) => {
//     try {
//       const result = await getResource({ id: req.params.id })
//       res.json(result)
//     } catch (error) {
//       const message = error instanceof Error ? error.message : 'Internal server error'
//       res.status(500).json({ error: message })
//     }
//   })
// ------------------------------------------------------------------

// Example endpoint — replace with your actual OpenAPI operations
const query = sg.wrap(
  async (args: { query: string }) => {
    // TODO: Forward to your upstream API
    // const res = await fetch(`${UPSTREAM_URL}/search?q=${encodeURIComponent(args.query)}`)
    // return res.json()
    return { result: `Response for: ${args.query}`, upstream: UPSTREAM_URL }
  },
  { method: 'query' }
)

app.post('/query', async (req, res) => {
  try {
    const result = await query(req.body)
    res.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    res.status(500).json({ error: message })
  }
})

// Health check (no billing)
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', tool: '{{TOOL_SLUG}}', timestamp: new Date().toISOString() })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`{{TOOL_NAME}} running at http://localhost:${PORT}`)
  console.log(`Health check: http://localhost:${PORT}/health`)
})
