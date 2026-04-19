# settlegrid-inngest

Inngest MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-inngest)

Manage Inngest events, function runs, and functions via the Inngest REST API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_events(limit?: number)` | List events | 1¢ |
| `get_event(eventId: string)` | Get a specific event by ID | 1¢ |
| `send_event(name: string, data: Record<string, unknown>, id?: string)` | Send/create a new event | 3¢ |
| `get_event_runs(eventId: string)` | Get function runs triggered by a specific event | 1¢ |
| `list_runs(limit?: number)` | List function runs | 1¢ |
| `get_run(runId: string)` | Get a specific function run by ID | 1¢ |
| `cancel_run(runId: string)` | Cancel a specific function run | 3¢ |
| `list_functions(limit?: number)` | List all registered functions | 1¢ |

## Parameters

### list_events
- `limit` (number) — Maximum number of events to return (default 20, max 50)

### get_event
- `eventId` (string, required) — The ID of the event to retrieve

### send_event
- `name` (string, required) — The event name (e.g. app/user.created)
- `data` (object, required) — Event payload data as a JSON object
- `id` (string) — Optional idempotency key for the event

### get_event_runs
- `eventId` (string, required) — The ID of the event whose runs to retrieve

### list_runs
- `limit` (number) — Maximum number of runs to return (default 20, max 50)

### get_run
- `runId` (string, required) — The ID of the function run to retrieve

### cancel_run
- `runId` (string, required) — The ID of the function run to cancel

### list_functions
- `limit` (number) — Maximum number of functions to return (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `INNGEST_API_KEY` | Yes | Inngest API key from [https://app.inngest.com/settings/api-keys](https://app.inngest.com/settings/api-keys) |

## Upstream API

- **Provider**: Inngest
- **Base URL**: https://api.inngest.com
- **Auth**: API key required
- **Docs**: https://www.inngest.com/docs/reference/rest-api

## Deploy

### Docker

```bash
docker build -t settlegrid-inngest .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-inngest
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
