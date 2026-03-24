# settlegrid-oecd-data

OECD Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-oecd-data)

OECD economic statistics, GDP, unemployment, and trade data via SDMX.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_dataset(dataflow, filter)` | Fetch OECD dataset | 1¢ |
| `get_dataflows()` | List available dataflows | 1¢ |
| `get_gdp(country)` | GDP data for a country | 1¢ |

## Parameters

### get_dataset
- `dataflow` (string, required) — Dataflow ID (e.g. QNA for quarterly national accounts)
- `filter` (string) — SDMX key filter (e.g. USA.B1_GE.VOBARSA.Q)

### get_dataflows

### get_gdp
- `country` (string, required) — ISO 3-letter country code (e.g. USA)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OECD SDMX API — it is completely free.

## Upstream API

- **Provider**: OECD SDMX
- **Base URL**: https://sdmx.oecd.org/public/rest
- **Auth**: None required
- **Docs**: https://data.oecd.org/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-oecd-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-oecd-data
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
