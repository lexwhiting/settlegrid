# settlegrid-etf-data

ETF Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-etf-data)

ETF holdings, profiles, and performance data via Financial Modeling Prep. Search and analyze ETFs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_holdings(symbol, limit?)` | Get ETF holdings | 2¢ |
| `get_profile(symbol)` | Get ETF profile | 2¢ |
| `search_etfs(query)` | Search ETFs | 2¢ |

## Parameters

### get_holdings
- `symbol` (string, required) — ETF ticker symbol (e.g., SPY, QQQ)
- `limit` (number) — Max holdings to return (default: 20)

### get_profile
- `symbol` (string, required) — ETF ticker symbol

### search_etfs
- `query` (string, required) — Search term (name, theme, sector)

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
docker build -t settlegrid-etf-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-etf-data
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
