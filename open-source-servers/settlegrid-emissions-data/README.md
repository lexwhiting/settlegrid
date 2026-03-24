# settlegrid-emissions-data

Emissions Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-emissions-data)

Country CO2 emissions, per-capita data, and global trends.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_emissions(country_code)` | Get total CO2 emissions | 1¢ |
| `get_emissions_per_capita(country_code)` | Get CO2 per capita | 1¢ |
| `get_global_emissions_trend()` | Get global emissions trend | 1¢ |

## Parameters

### get_emissions
- `country_code` (string, required) — ISO alpha-2 or alpha-3 code
### get_emissions_per_capita
- `country_code` (string, required) — ISO alpha-2 or alpha-3 code
### get_global_emissions_trend
No parameters required.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: World Bank Open Data
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-emissions-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-emissions-data
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
