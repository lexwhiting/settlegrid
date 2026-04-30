# settlegrid-airbyte

Airbyte MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-airbyte)

Create and manage Airbyte data pipeline sources via the Airbyte API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_source(name: string, workspaceId: string, configuration: Record<string, unknown>)` | Create a new data source in an Airbyte workspace | 5¢ |

## Parameters

### create_source
- `name` (string, required) — Human-readable name for the source
- `workspaceId` (string, required) — UUID of the Airbyte workspace to associate the source with
- `configuration` (object, required) — JSON object containing the connector-specific configuration for the source

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AIRBYTE_API_KEY` | Yes | Airbyte API key from [https://app.airbyte.com/settings/api-keys](https://app.airbyte.com/settings/api-keys) |

## Upstream API

- **Provider**: Airbyte
- **Base URL**: https://api.airbyte.com/v1
- **Auth**: API key required
- **Docs**: https://reference.airbyte.com/reference/createsource

## Deploy

### Docker

```bash
docker build -t settlegrid-airbyte .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-airbyte
```

### Vercel

Click the "Deploy with Vercel" button above, or:

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
