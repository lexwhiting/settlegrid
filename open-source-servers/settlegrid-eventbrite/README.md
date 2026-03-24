# settlegrid-eventbrite

Eventbrite MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-eventbrite)

Search and discover events via the Eventbrite API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + EVENTBRITE_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_events(q, location)` | Search events by keyword and location | 2¢ |
| `get_event(id)` | Get event details by ID | 2¢ |

## Parameters

### search_events
- `q` (string, required)
- `location` (string, optional)

### get_event
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EVENTBRITE_TOKEN` | Yes | OAuth token from eventbrite.com/platform |


## Upstream API

- **Provider**: Eventbrite
- **Base URL**: https://www.eventbriteapi.com/v3
- **Auth**: Free API key required
- **Rate Limits**: 2000 req/hr
- **Docs**: https://www.eventbrite.com/platform/api

## Deploy

### Docker

```bash
docker build -t settlegrid-eventbrite .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e EVENTBRITE_TOKEN=xxx -p 3000:3000 settlegrid-eventbrite
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
