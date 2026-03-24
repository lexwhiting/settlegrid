# settlegrid-reit-data

REIT Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reit-data)

Real Estate Investment Trust performance, listings, and dividend data via Financial Modeling Prep.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_reits(sector?)` | List REITs by sector | 2¢ |
| `get_reit(symbol)` | Get REIT profile | 2¢ |
| `get_dividends(symbol)` | Get REIT dividend history | 2¢ |

## Parameters

### list_reits
- `sector` (string) — REIT sector (residential, office, retail, healthcare, etc.)

### get_reit
- `symbol` (string, required) — REIT ticker symbol

### get_dividends
- `symbol` (string, required) — REIT ticker symbol

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
docker build -t settlegrid-reit-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-reit-data
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
