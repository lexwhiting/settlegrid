# settlegrid-disaster-events

Natural Disaster Events MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-disaster-events)

Natural disaster event tracking from NASA EONET.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_events(category)` | Get recent natural disaster events | 1¢ |
| `get_categories()` | List available event categories | 1¢ |
| `get_event(id)` | Get details for a specific event by ID | 1¢ |

## Parameters

### get_events
- `category` (string, optional)

### get_event
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NASA EONET
- **Base URL**: https://eonet.gsfc.nasa.gov/api/v3
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://eonet.gsfc.nasa.gov/docs/v3

## Deploy

### Docker

```bash
docker build -t settlegrid-disaster-events .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-disaster-events
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
