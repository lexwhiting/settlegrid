# settlegrid-covid-tracking

COVID Tracking MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-covid-tracking)

COVID-19 global and country-level statistics with historical data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_global()` | Get global COVID-19 totals | 1¢ |
| `get_country(country)` | Get COVID-19 stats for a specific country | 1¢ |
| `get_historical(country, days)` | Get historical COVID-19 data for a country | 1¢ |

## Parameters

### get_country
- `country` (string, required)

### get_historical
- `country` (string, required)
- `days` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Disease.sh
- **Base URL**: https://disease.sh
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://disease.sh/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-covid-tracking .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-covid-tracking
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
