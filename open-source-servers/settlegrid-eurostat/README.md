# settlegrid-eurostat

Eurostat MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-eurostat)

EU statistical data on GDP, population, trade, and more from Eurostat.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_dataset(datasetCode, filters)` | Fetch Eurostat dataset | 1¢ |
| `get_gdp(country)` | GDP data for EU countries | 1¢ |
| `get_population(country)` | Population data | 1¢ |

## Parameters

### get_dataset
- `datasetCode` (string, required) — Dataset code (e.g. nama_10_gdp)
- `filters` (string) — Filter params (e.g. "geo=DE&time=2023")

### get_gdp
- `country` (string) — Country code (e.g. DE, FR)

### get_population
- `country` (string) — Country code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Eurostat API — it is completely free.

## Upstream API

- **Provider**: Eurostat
- **Base URL**: https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0
- **Auth**: None required
- **Docs**: https://wikis.ec.europa.eu/display/EUROSTATHELP/API+Statistics+-+data+query

## Deploy

### Docker

```bash
docker build -t settlegrid-eurostat .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-eurostat
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
