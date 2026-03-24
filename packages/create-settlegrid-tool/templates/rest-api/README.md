# {{TOOL_NAME}}

{{DESCRIPTION}}

## Quick Start

```bash
npm install
npm run dev
```

The server starts at `http://localhost:3000`.

## Endpoints

| Endpoint | Method | Cost |
| --- | --- | --- |
| `POST /query` | query | {{PRICE_CENTS}} cents per call |
| `GET /health` | - | Free |

## Pricing

Billing is handled automatically by [SettleGrid](https://settlegrid.ai). Users purchase credits and are billed per call via the `x-settlegrid-api-key` header.

## Development

```bash
npm run dev      # Start with hot reload (tsx watch)
npm run build    # Compile TypeScript
npm start        # Run compiled output
```

## Deploy

Register your tool at [settlegrid.ai/dashboard/tools](https://settlegrid.ai/dashboard/tools) to start accepting payments.

## Documentation

- [SettleGrid Docs](https://settlegrid.ai/docs)
- [@settlegrid/mcp SDK](https://www.npmjs.com/package/@settlegrid/mcp)
