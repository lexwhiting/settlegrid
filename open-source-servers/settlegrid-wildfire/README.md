# settlegrid-wildfire

Wildfire Events MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wildfire)

Active wildfire events from NASA EONET (Earth Observatory Natural Event Tracker).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_active_fires()` | Get currently active wildfire events | 1¢ |
| `get_fire_by_id(id)` | Get details for a specific fire event by ID | 1¢ |

## Parameters

### get_fire_by_id
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
docker build -t settlegrid-wildfire .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-wildfire
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
