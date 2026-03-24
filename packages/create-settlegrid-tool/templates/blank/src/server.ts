import { settlegrid } from '@settlegrid/mcp'

const sg = settlegrid.init({
  toolSlug: '{{TOOL_SLUG}}', // Replace with your registered slug from settlegrid.ai
  pricing: {
    defaultCostCents: {{PRICE_CENTS}},
    methods: {
      'query': { costCents: {{PRICE_CENTS}}, displayName: 'Query' },
    },
  },
})

// Your tool handler — replace with your actual logic
async function handleQuery(args: { query: string }) {
  // TODO: Implement your tool logic here
  return { result: `Response for: ${args.query}` }
}

// Wrap with SettleGrid billing
export const query = sg.wrap(handleQuery, { method: 'query' })

// Example usage:
// const result = await query({ query: 'hello world' })
// console.log(result)
