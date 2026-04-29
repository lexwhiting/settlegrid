# settlegrid-apify

Apify MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-apify)

Manage and run Apify Actors, datasets, and key-value stores via the Apify platform API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_actors(limit?: number, offset?: number)` | List available Actors in your Apify account | 1¢ |
| `get_actor(actorId: string)` | Get details of a specific Actor by ID | 1¢ |
| `run_actor(actorId: string, input?: Record<string, unknown>, timeout?: number)` | Run an Actor with optional input and wait for finish | 10¢ |
| `get_actor_run(actorId: string, runId: string)` | Get the status and details of an Actor run | 1¢ |
| `get_dataset_items(datasetId: string, limit?: number, offset?: number)` | Retrieve items from an Apify dataset | 2¢ |
| `get_key_value_store_record(storeId: string, key: string)` | Get a record from an Apify key-value store | 1¢ |
| `list_actor_runs(actorId: string, limit?: number, status?: string)` | List runs for a specific Actor | 1¢ |

## Parameters

### list_actors
- `limit` (number) — Maximum number of Actors to return (default 20, max 50)
- `offset` (number) — Number of Actors to skip (default 0)

### get_actor
- `actorId` (string, required) — The ID or name of the Actor (e.g. 'apify/web-scraper' or an actor ID)

### run_actor
- `actorId` (string, required) — The ID or name of the Actor to run
- `input` (object) — JSON input object passed to the Actor
- `timeout` (number) — Timeout in seconds to wait for the run to finish (default 60, max 300)

### get_actor_run
- `actorId` (string, required) — The ID or name of the Actor
- `runId` (string, required) — The ID of the Actor run

### get_dataset_items
- `datasetId` (string, required) — The ID of the dataset to fetch items from
- `limit` (number) — Maximum number of items to return (default 20, max 50)
- `offset` (number) — Number of items to skip (default 0)

### get_key_value_store_record
- `storeId` (string, required) — The ID of the key-value store
- `key` (string, required) — The key of the record to retrieve

### list_actor_runs
- `actorId` (string, required) — The ID or name of the Actor
- `limit` (number) — Maximum number of runs to return (default 10, max 50)
- `status` (string) — Filter by run status: READY, RUNNING, SUCCEEDED, FAILED, TIMED-OUT, ABORTED

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `APIFY_API_TOKEN` | Yes | Apify API key from [https://console.apify.com/account/integrations](https://console.apify.com/account/integrations) |

## Upstream API

- **Provider**: Apify
- **Base URL**: https://api.apify.com/v2
- **Auth**: API key required
- **Docs**: https://docs.apify.com/api/v2/getting-started

## Deploy

### Docker

```bash
docker build -t settlegrid-apify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-apify
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
