# settlegrid-zillow

Zillow (Bridge API) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-zillow)

Home values and property listings via the Bridge Interactive API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BRIDGE_API_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_properties(city, state)` | Search property listings by city and state | 2¢ |
| `get_property(listing_id)` | Get details for a specific listing | 2¢ |

## Parameters

### search_properties
- `city` (string, required)
- `state` (string, required)

### get_property
- `listing_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BRIDGE_API_TOKEN` | Yes | API token from bridgedataoutput.com |


## Upstream API

- **Provider**: Bridge Interactive
- **Base URL**: https://api.bridgedataoutput.com/api/v2
- **Auth**: Free API key required
- **Rate Limits**: Plan-based
- **Docs**: https://bridgedataoutput.com/docs/platform

## Deploy

### Docker

```bash
docker build -t settlegrid-zillow .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BRIDGE_API_TOKEN=xxx -p 3000:3000 settlegrid-zillow
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
