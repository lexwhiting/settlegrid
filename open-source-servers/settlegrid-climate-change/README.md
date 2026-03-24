# settlegrid-climate-change

Climate Change Indicators MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-climate-change)

Climate change indicators and temperature data from World Bank.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_co2_emissions(country)` | Get CO2 emissions per capita by country ISO code | 1¢ |
| `get_temperature_change(country)` | Get average temperature data by country | 1¢ |
| `get_forest_area(country)` | Get forest area as percentage of land by country | 1¢ |

## Parameters

### get_co2_emissions
- `country` (string, required)

### get_temperature_change
- `country` (string, required)

### get_forest_area
- `country` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: World Bank
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/topics/125589

## Deploy

### Docker

```bash
docker build -t settlegrid-climate-change .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-climate-change
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
