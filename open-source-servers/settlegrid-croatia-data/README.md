# settlegrid-croatia-data

Croatia Bureau of Statistics (DZS) open data MCP Server with SettleGrid billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-croatia-data)

Croatia Bureau of Statistics (DZS) open data MCP Server with SettleGrid billing

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_population(year)` | Get Croatia population statistics | 2¢ |
| `get_economic_data(indicator)` | Get economic indicators (GDP, unemployment, etc.) | 2¢ |

## Parameters

### get_population
- `year` (number, optional) — Year for population data (default 2021)

### get_economic_data
- `indicator` (string, required) — Economic indicator (gdp, unemployment, inflation, population, gdp_per_capita, exports)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: Croatian Bureau of Statistics (DZS)
- **Base URL**: https://web.dzs.hr/PXWeb/api/v1/en/
- **Auth**: None required
- **Docs**: https://web.dzs.hr/

## Deploy

### Docker

```bash
docker build -t settlegrid-croatia-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-croatia-data
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
