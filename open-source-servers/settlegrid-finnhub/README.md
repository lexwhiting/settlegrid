# settlegrid-finnhub

Finnhub MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-finnhub)

Real-time stock data, company fundamentals, and financial news

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FINNHUB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_quote(symbol)` | Get real-time stock quote | 1¢ |
| `get_company_profile(symbol)` | Get company profile and fundamentals | 1¢ |
| `get_company_news(symbol, from, to)` | Get latest company news articles | 2¢ |

## Parameters

### get_quote
- `symbol` (string, required) — Stock ticker (e.g. AAPL)

### get_company_profile
- `symbol` (string, required) — Stock ticker

### get_company_news
- `symbol` (string, required) — Stock ticker
- `from` (string, required) — Start date YYYY-MM-DD
- `to` (string, required) — End date YYYY-MM-DD

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FINNHUB_API_KEY` | Yes | Finnhub API key from [https://finnhub.io/register](https://finnhub.io/register) |

## Upstream API

- **Provider**: Finnhub
- **Base URL**: https://finnhub.io/api/v1
- **Auth**: API key (query)
- **Docs**: https://finnhub.io/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-finnhub .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FINNHUB_API_KEY=xxx -p 3000:3000 settlegrid-finnhub
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
