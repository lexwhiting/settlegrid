# {{TOOL_NAME}}

{{DESCRIPTION}}

Built from an OpenAPI spec with [SettleGrid](https://settlegrid.ai) billing.

## Quick Start

```bash
npm install
npm run dev
```

The server starts at `http://localhost:3000`.

## Adding Endpoints

Add endpoints from your OpenAPI spec in `src/server.ts`. Each endpoint is wrapped with SettleGrid billing:

```typescript
const myEndpoint = sg.wrap(
  async (args: { id: string }) => {
    const response = await fetch(`${UPSTREAM_URL}/resource/${args.id}`)
    return response.json()
  },
  { method: 'get-resource' }
)
```

## Pricing

| Method | Cost |
| --- | --- |
| Default | {{PRICE_CENTS}} cents per call |

Billing is handled automatically by [SettleGrid](https://settlegrid.ai).

## Development

```bash
npm run dev      # Start with hot reload
npm run build    # Compile TypeScript
npm start        # Run compiled output
```

## Deploy

Register your tool at [settlegrid.ai/dashboard/tools](https://settlegrid.ai/dashboard/tools) to start accepting payments.

## Documentation

- [SettleGrid Docs](https://settlegrid.ai/docs)
- [@settlegrid/mcp SDK](https://www.npmjs.com/package/@settlegrid/mcp)
