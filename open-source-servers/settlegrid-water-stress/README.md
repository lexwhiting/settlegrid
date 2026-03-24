# settlegrid-water-stress

Water Stress Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-water-stress)

Water stress levels, freshwater withdrawal, and water risk rankings.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_water_stress(country_code)` | Get water stress level | 1¢ |
| `get_freshwater_withdrawal(country_code)` | Get freshwater data | 1¢ |
| `get_water_risk_ranking(limit)` | Get water risk ranking | 1¢ |

## Parameters

### get_water_stress / get_freshwater_withdrawal
- `country_code` (string, required) — ISO alpha-2 code
### get_water_risk_ranking
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
docker build -t settlegrid-water-stress .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-water-stress
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
