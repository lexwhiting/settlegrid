# settlegrid-unicef

UNICEF Child Welfare Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unicef)

Access UNICEF child welfare statistics via the UNICEF SDMX API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_indicators(query)` | Search UNICEF indicators | 1¢ |
| `get_data(indicator, country?)` | Get data for an indicator and country | 2¢ |
| `list_datasets()` | List available UNICEF datasets | 1¢ |

## Parameters

### search_indicators
- `query` (string, required) — Search term (e.g. "mortality", "nutrition")

### get_data
- `indicator` (string, required) — UNICEF indicator/dataflow ID (e.g. GLOBAL_DATAFLOW)
- `country` (string) — ISO2 country code (e.g. US, GB)

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UNICEF SDMX API API — it is completely free.

## Upstream API

- **Provider**: UNICEF SDMX API
- **Base URL**: https://sdmx.data.unicef.org/ws/public/sdmxapi/rest
- **Auth**: None required
- **Docs**: https://data.unicef.org/resources/dataset/sdmx/

## Deploy

### Docker

```bash
docker build -t settlegrid-unicef .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-unicef
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
