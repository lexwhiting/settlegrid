# settlegrid-hightouch

Hightouch MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hightouch)

Interact with Hightouch syncs, models, sources, and destinations via the Hightouch REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_syncs(limit?: number)` | List all syncs in the workspace | 1¢ |
| `get_sync(syncId: string)` | Get details for a specific sync by ID | 1¢ |
| `trigger_sync(syncId: string, fullResync?: boolean)` | Trigger a sync run for a specific sync | 5¢ |
| `list_sync_runs(syncId: string, limit?: number)` | List runs for a specific sync | 1¢ |
| `list_models(limit?: number)` | List all models in the workspace | 1¢ |
| `get_model(modelId: string)` | Get details for a specific model by ID | 1¢ |
| `list_sources(limit?: number)` | List all sources in the workspace | 1¢ |
| `list_destinations(limit?: number)` | List all destinations in the workspace | 1¢ |

## Parameters

### list_syncs
- `limit` (number) — Maximum number of syncs to return (default 20, max 50)

### get_sync
- `syncId` (string, required) — The unique identifier of the sync

### trigger_sync
- `syncId` (string, required) — The unique identifier of the sync to trigger
- `fullResync` (boolean) — Whether to perform a full resync (default false)

### list_sync_runs
- `syncId` (string, required) — The unique identifier of the sync
- `limit` (number) — Maximum number of runs to return (default 20, max 50)

### list_models
- `limit` (number) — Maximum number of models to return (default 20, max 50)

### get_model
- `modelId` (string, required) — The unique identifier of the model

### list_sources
- `limit` (number) — Maximum number of sources to return (default 20, max 50)

### list_destinations
- `limit` (number) — Maximum number of destinations to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HIGHTOUCH_API_KEY` | Yes | Hightouch API key from [https://app.hightouch.com/settings/api-keys](https://app.hightouch.com/settings/api-keys) |

## Upstream API

- **Provider**: Hightouch
- **Base URL**: https://api.hightouch.com/api/v1
- **Auth**: API key required
- **Docs**: https://hightouch.com/docs/developer-tools/api-guide

## Deploy

### Docker

```bash
docker build -t settlegrid-hightouch .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hightouch
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
