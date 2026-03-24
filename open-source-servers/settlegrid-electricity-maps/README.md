# settlegrid-electricity-maps

Electricity Maps MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-electricity-maps)

Global electricity grid CO2 emissions and renewable energy data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_zone_carbon(zone)` | Get carbon intensity for zone | 2¢ |

## Parameters

### get_zone_carbon
- `zone` (string, required) — Zone code (e.g. US-CAL-CISO, DE, FR)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ELECTRICITYMAPS_API_KEY` | Yes | Electricity Maps API key from [https://api-portal.electricitymaps.com/](https://api-portal.electricitymaps.com/) |

## Upstream API

- **Provider**: Electricity Maps
- **Base URL**: https://api.electricitymap.org/v3
- **Auth**: API key required
- **Docs**: https://static.electricitymaps.com/api/docs/index.html

## Deploy

### Docker

```bash
docker build -t settlegrid-electricity-maps .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-electricity-maps
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
