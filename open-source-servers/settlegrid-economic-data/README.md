# settlegrid-economic-data

Federal Reserve Economic Data (FRED) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-economic-data)

Access 800,000+ economic time series from the Federal Reserve Bank of St. Louis. GDP, unemployment, inflation, interest rates, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid + FRED API keys
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_series(seriesId)` | Fetch observations for a time series | 2¢ |
| `search_series(query)` | Search 800K+ economic data series | 1¢ |
| `get_categories()` | Browse the FRED category tree | 1¢ |

## Parameters

### get_series
- `seriesId` (string, required) — FRED series ID (e.g. "GDP", "UNRATE", "CPIAUCSL")
- `limit` (number, optional) — Max observations to return (default 100, max 1000)
- `sortOrder` (string, optional) — "asc" or "desc" (default "desc")

### search_series
- `query` (string, required) — Search text (e.g. "unemployment rate")
- `limit` (number, optional) — Max results (default 20, max 100)

### get_categories
- `categoryId` (number, optional) — Category ID to browse (default 0 = root)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FRED_API_KEY` | Yes | Free FRED API key from [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) |

## Popular Series IDs

| ID | Description |
|----|-------------|
| `GDP` | Gross Domestic Product |
| `UNRATE` | Unemployment Rate |
| `CPIAUCSL` | Consumer Price Index |
| `FEDFUNDS` | Federal Funds Rate |
| `DGS10` | 10-Year Treasury Rate |
| `SP500` | S&P 500 Index |

## Upstream API

- **Provider**: Federal Reserve Bank of St. Louis
- **Base URL**: https://api.stlouisfed.org/fred
- **Auth**: Free API key required
- **Rate Limits**: 120 requests/minute
- **Docs**: https://fred.stlouisfed.org/docs/api/fred/

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
