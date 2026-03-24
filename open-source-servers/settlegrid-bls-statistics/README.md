# settlegrid-bls-statistics

Bureau of Labor Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bls-statistics)

Employment, CPI, PPI, and labor market data from the BLS API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_series(seriesId, startYear, endYear)` | Get time series data | 2¢ |
| `get_cpi(startYear, endYear)` | Consumer Price Index (CPI-U) | 2¢ |
| `get_unemployment(startYear, endYear)` | National unemployment rate | 2¢ |

## Parameters

### get_series
- `seriesId` (string, required) — BLS series ID (e.g. CUUR0000SA0 for CPI-U)
- `startYear` (string, required) — Start year
- `endYear` (string, required) — End year

### get_cpi
- `startYear` (string, required) — Start year
- `endYear` (string, required) — End year

### get_unemployment
- `startYear` (string, required) — Start year
- `endYear` (string, required) — End year

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BLS_API_KEY` | Yes | BLS API key from [https://data.bls.gov/registrationEngine/](https://data.bls.gov/registrationEngine/) |

## Upstream API

- **Provider**: BLS
- **Base URL**: https://api.bls.gov/publicAPI/v2
- **Auth**: API key required
- **Docs**: https://www.bls.gov/developers/

## Deploy

### Docker

```bash
docker build -t settlegrid-bls-statistics .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bls-statistics
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
