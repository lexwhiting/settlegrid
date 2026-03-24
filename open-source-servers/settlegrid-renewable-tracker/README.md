# settlegrid-renewable-tracker

Renewable Energy Tracker MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-renewable-tracker)

Renewable energy production and share data by country.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_renewable_share(country_code)` | Get renewable energy share | 1¢ |
| `get_renewable_trend(country_code)` | Get trend over time | 1¢ |
| `compare_countries(codes)` | Compare multiple countries | 2¢ |

## Parameters

### get_renewable_share
- `country_code` (string, required) — ISO alpha-2 or alpha-3 code
### get_renewable_trend
- `country_code` (string, required) — ISO code
- `years` (number, optional) — Years of history (default 10, max 30)
### compare_countries
- `codes` (string, required) — Semicolon-separated ISO codes

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: World Bank Open Data
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

## Deploy

### Docker
```bash
docker build -t settlegrid-renewable-tracker .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-renewable-tracker
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
