# settlegrid-token-prices

Multi-Chain Token Price MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-token-prices)

Get real-time cryptocurrency prices for any token. Wraps the free CoinGecko API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_price(token)` | Price for a single token | 1¢ |
| `get_prices(tokens[])` | Prices for multiple tokens | 1¢/token |

## Parameters

### get_price
- `token` (string, required) — CoinGecko token ID (e.g. "bitcoin", "ethereum")

### get_prices
- `tokens` (string[], required) — Array of CoinGecko token IDs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: CoinGecko
- **Base URL**: https://api.coingecko.com/api/v3
- **Auth**: None required for free tier
- **Docs**: https://www.coingecko.com/en/api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-token-prices .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-token-prices
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
