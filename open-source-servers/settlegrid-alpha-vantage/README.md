# settlegrid-alpha-vantage

Alpha Vantage MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-alpha-vantage)

Stock prices, forex, crypto, and technical indicators with 25+ years of data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ALPHA_VANTAGE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_quote(symbol)` | Get real-time stock quote | 1¢ |
| `get_daily(symbol)` | Get daily price time series | 2¢ |
| `search_symbol(keywords)` | Search for stock symbols by name | 1¢ |

## Parameters

### get_quote
- `symbol` (string, required) — Stock ticker (e.g. AAPL, MSFT)

### get_daily
- `symbol` (string, required) — Stock ticker
- `outputsize` (string, optional) — compact (100 days) or full (default: "compact")

### search_symbol
- `keywords` (string, required) — Search keywords (e.g. Apple, Tesla)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ALPHA_VANTAGE_API_KEY` | Yes | Alpha Vantage API key from [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) |

## Upstream API

- **Provider**: Alpha Vantage
- **Base URL**: https://www.alphavantage.co/query
- **Auth**: API key (query)
- **Docs**: https://www.alphavantage.co/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-alpha-vantage .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ALPHA_VANTAGE_API_KEY=xxx -p 3000:3000 settlegrid-alpha-vantage
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
