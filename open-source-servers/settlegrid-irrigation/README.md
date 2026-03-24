# settlegrid-irrigation

Irrigation and Water Use Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-irrigation)

Access irrigation water use data from USGS National Water Information System. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_water_use(state, year?)` | Get water use data by state | 2¢ |
| `list_sites(state)` | List monitoring sites in a state | 2¢ |
| `get_trends(state)` | Get water use trends by state | 2¢ |

## Parameters

### get_water_use
- `state` (string, required) — US state abbreviation (e.g. CA, TX, NE)
- `year` (number) — Year to query (e.g. 2020)

### list_sites
- `state` (string, required) — US state abbreviation

### get_trends
- `state` (string, required) — US state abbreviation

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USGS NWIS API — it is completely free.

## Upstream API

- **Provider**: USGS NWIS
- **Base URL**: https://waterservices.usgs.gov/nwis
- **Auth**: None required
- **Docs**: https://waterservices.usgs.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-irrigation .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-irrigation
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
