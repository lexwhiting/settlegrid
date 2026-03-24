# settlegrid-green-energy

Green Energy Mix MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-green-energy)

Energy generation mix data — solar, wind, hydro, nuclear, fossil — by country.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_energy_mix(country)` | Get energy generation mix | 1¢ |
| `get_generation_trend(country)` | Get generation trend | 1¢ |
| `get_clean_energy_ranking(limit)` | Get clean energy ranking | 1¢ |

## Parameters

### get_energy_mix / get_generation_trend
- `country` (string, required) — ISO alpha-2 or alpha-3 code
### get_clean_energy_ranking
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
docker build -t settlegrid-green-energy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-green-energy
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
