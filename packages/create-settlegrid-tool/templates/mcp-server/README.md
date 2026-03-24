# {{TOOL_NAME}}

{{DESCRIPTION}}

A full MCP (Model Context Protocol) server with SettleGrid billing.

## Quick Start

```bash
npm install
npm run dev
```

## MCP Configuration

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "{{TOOL_SLUG}}": {
      "command": "node",
      "args": ["dist/server.js"]
    }
  }
}
```

## Tools

| Tool | Description | Cost |
| --- | --- | --- |
| `query` | Run a query | {{PRICE_CENTS}} cents per call |

## Pricing

Billing is handled automatically by [SettleGrid](https://settlegrid.ai). Users purchase credits and are billed per call.

## Development

```bash
npm run dev      # Start with hot reload
npm run build    # Compile TypeScript
npm start        # Run compiled output
```

## Deploy

Register your tool at [settlegrid.ai/dashboard/tools](https://settlegrid.ai/dashboard/tools) to start accepting payments.

## Documentation

- [MCP Specification](https://modelcontextprotocol.io)
- [SettleGrid Docs](https://settlegrid.ai/docs)
- [@settlegrid/mcp SDK](https://www.npmjs.com/package/@settlegrid/mcp)
