import express from 'express'
import { settlegrid } from '@settlegrid/mcp'

const app = express()
app.use(express.json())

const sg = settlegrid.init({
  toolSlug: '{{TOOL_SLUG}}', // Replace with your registered slug from settlegrid.ai
  pricing: {
    defaultCostCents: {{PRICE_CENTS}},
    methods: {
      'query': { costCents: {{PRICE_CENTS}}, displayName: 'Query' },
    },
  },
})

// Wrap your handler with SettleGrid billing
const query = sg.wrap(
  async (args: { query: string }) => {
    // TODO: Implement your tool logic here
    return { result: `Response for: ${args.query}` }
  },
  { method: 'query' }
)

// Routes
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
