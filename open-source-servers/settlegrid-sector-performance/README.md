# settlegrid-sector-performance

Sector Performance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sector-performance)

S&P 500 sector and industry performance data via Financial Modeling Prep. Daily, weekly, monthly returns.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_performance(period?)` | Get sector performance | 2¢ |
| `get_sector(name)` | Get specific sector details | 2¢ |
| `get_historical(sector, months?)` | Get historical sector returns | 2¢ |

## Parameters

### get_performance
- `period` (string) — Period: 1D, 5D, 1M, 3M, YTD, 1Y (default: 1D)

### get_sector
- `name` (string, required) — Sector name (Technology, Healthcare, etc.)

### get_historical
- `sector` (string, required) — Sector name
- `months` (number) — Months of history (default: 6)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key from [https://financialmodelingprep.com/developer](https://financialmodelingprep.com/developer) |

## Upstream API

- **Provider**: Financial Modeling Prep
- **Base URL**: https://financialmodelingprep.com/api/v3
- **Auth**: API key required
- **Docs**: https://site.financialmodelingprep.com/developer/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-sector-performance .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sector-performance
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
