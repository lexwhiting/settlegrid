# settlegrid-financial-modeling

Financial Modeling Prep MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-financial-modeling)

Company financials, DCF valuations, and stock data via Financial Modeling Prep.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_profile(symbol)` | Company profile | 2¢ |
| `get_income_statement(symbol)` | Income statement | 2¢ |
| `get_dcf(symbol)` | Discounted cash flow valuation | 2¢ |

## Parameters

### get_profile
- `symbol` (string, required) — Stock ticker (e.g. AAPL)

### get_income_statement
- `symbol` (string, required) — Stock ticker

### get_dcf
- `symbol` (string, required) — Stock ticker

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FMP_API_KEY` | Yes | Financial Modeling Prep API key from [https://site.financialmodelingprep.com/developer/docs](https://site.financialmodelingprep.com/developer/docs) |

## Upstream API

- **Provider**: Financial Modeling Prep
- **Base URL**: https://financialmodelingprep.com/api/v3
- **Auth**: API key required
- **Docs**: https://site.financialmodelingprep.com/developer/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-financial-modeling .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-financial-modeling
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
