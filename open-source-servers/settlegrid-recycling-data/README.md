# settlegrid-recycling-data

Recycling Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-recycling-data)

Waste recycling rates and solid waste data by country.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recycling_rate(country_code)` | Get recycling rate | 1¢ |
| `get_waste_composition(country_code)` | Get waste composition | 1¢ |
| `get_top_recyclers(limit)` | Get top recycling countries | 1¢ |

## Parameters

### get_recycling_rate / get_waste_composition
- `country_code` (string, required) — ISO alpha-2 code
### get_top_recyclers
- `limit` (number, optional) — Results (default 20, max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: World Bank Open Data
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-recycling-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-recycling-data
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
