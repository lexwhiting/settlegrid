# settlegrid-financial-modeling-prep

Financial Modeling Prep MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-financial-modeling-prep)

Stock financials, SEC filings, earnings, and company data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FMP_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_profile(symbol)` | Get company financial profile | 1¢ |
| `get_income_statement(symbol)` | Get annual income statement | 2¢ |
| `get_gainers_losers()` | Get top gainers and losers today | 1¢ |

## Parameters

### get_profile
- `symbol` (string, required) — Stock ticker (e.g. AAPL)

### get_income_statement
- `symbol` (string, required) — Stock ticker
- `limit` (number, optional) — Number of years (default: 5)

### get_gainers_losers

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key from [https://financialmodelingprep.com/developer/docs/](https://financialmodelingprep.com/developer/docs/) |

## Upstream API

- **Provider**: Financial Modeling Prep
- **Base URL**: https://financialmodelingprep.com/api/v3
- **Auth**: API key (query)
- **Docs**: https://financialmodelingprep.com/developer/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-financial-modeling-prep .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FMP_API_KEY=xxx -p 3000:3000 settlegrid-financial-modeling-prep
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
