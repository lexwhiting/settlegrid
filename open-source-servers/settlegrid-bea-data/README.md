# settlegrid-bea-data

Bureau of Economic Analysis MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bea-data)

GDP, personal income, and economic indicators from the BEA API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_gdp(year)` | GDP data (NIPA) | 2¢ |
| `get_datasets()` | List available BEA datasets | 1¢ |
| `get_regional_income(year, state)` | Regional personal income | 2¢ |

## Parameters

### get_gdp
- `year` (string, required) — Year (e.g. "2023")

### get_datasets

### get_regional_income
- `year` (string, required) — Year
- `state` (string) — State FIPS code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BEA_API_KEY` | Yes | BEA API key from [https://apps.bea.gov/api/signup/](https://apps.bea.gov/api/signup/) |

## Upstream API

- **Provider**: BEA
- **Base URL**: https://apps.bea.gov/api/data
- **Auth**: API key required
- **Docs**: https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf

## Deploy

### Docker

```bash
docker build -t settlegrid-bea-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bea-data
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
