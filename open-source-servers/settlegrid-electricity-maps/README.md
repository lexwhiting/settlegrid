# settlegrid-electricity-maps

Electricity Maps MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-electricity-maps)

Real-time carbon intensity and power breakdown by zone via Electricity Maps.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ELECTRICITYMAP_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_carbon_intensity(zone)` | Get real-time carbon intensity for a zone | 2¢ |
| `get_power_breakdown(zone)` | Get power generation breakdown by source for a zone | 2¢ |

## Parameters

### get_carbon_intensity
- `zone` (string, required)

### get_power_breakdown
- `zone` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ELECTRICITYMAP_TOKEN` | Yes | Free token from electricitymaps.com |


## Upstream API

- **Provider**: Electricity Maps
- **Base URL**: https://api.electricitymap.org/v3
- **Auth**: Free API key required
- **Rate Limits**: 30 req/hr (free)
- **Docs**: https://static.electricitymaps.com/api/docs/index.html

## Deploy

### Docker

```bash
docker build -t settlegrid-electricity-maps .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ELECTRICITYMAP_TOKEN=xxx -p 3000:3000 settlegrid-electricity-maps
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
