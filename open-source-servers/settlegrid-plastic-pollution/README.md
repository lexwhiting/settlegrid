# settlegrid-plastic-pollution

Plastic Pollution MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-plastic-pollution)

Ocean plastic and environmental pollution data by country.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_waste_data(country_code)` | Get waste data by country | 1¢ |
| `get_plastic_waste_trend(country_code)` | Get waste trend | 1¢ |
| `get_top_polluters(limit)` | Get top polluting countries | 1¢ |

## Parameters

### get_waste_data
- `country_code` (string, required) — ISO alpha-2 code
### get_plastic_waste_trend
- `country_code` (string, required) — ISO alpha-2 code
### get_top_polluters
- `limit` (number, optional) — Results count (default 20, max 50)

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
docker build -t settlegrid-plastic-pollution .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-plastic-pollution
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
