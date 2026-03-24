# settlegrid-alpha-vantage

Alpha Vantage MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-alpha-vantage)

Stock quotes, time series, and fundamentals via the Alpha Vantage API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_quote(symbol)` | Real-time stock quote | 2¢ |
| `get_daily(symbol)` | Daily time series prices | 2¢ |
| `search_symbol(keywords)` | Search ticker symbols by keyword | 2¢ |

## Parameters

### get_quote
- `symbol` (string, required) — Stock ticker (e.g. AAPL)

### get_daily
- `symbol` (string, required) — Stock ticker

### search_symbol
- `keywords` (string, required) — Search keywords (e.g. apple)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ALPHA_VANTAGE_API_KEY` | Yes | Alpha Vantage API key from [https://www.alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key) |

## Upstream API

- **Provider**: Alpha Vantage
- **Base URL**: https://www.alphavantage.co/query
- **Auth**: API key required
- **Docs**: https://www.alphavantage.co/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-alpha-vantage .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-alpha-vantage
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
