# settlegrid-pe-ratios

P/E Ratio Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pe-ratios)

Historical price-to-earnings ratios for S&P 500, Shiller CAPE, and individual stocks.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current(index?)` | Get current P/E ratio | 2¢ |
| `get_historical(years?)` | Get historical P/E ratios | 2¢ |
| `get_shiller_pe()` | Get Shiller CAPE ratio | 2¢ |

## Parameters

### get_current
- `index` (string) — Index or stock symbol (default: SPY)

### get_historical
- `years` (number) — Years of history (default: 5)

### get_shiller_pe

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
docker build -t settlegrid-pe-ratios .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pe-ratios
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
