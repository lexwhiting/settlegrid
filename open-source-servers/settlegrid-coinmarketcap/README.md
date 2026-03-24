# settlegrid-coinmarketcap

CoinMarketCap MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coinmarketcap)

Cryptocurrency market data, rankings, and metadata

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + COINMARKETCAP_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_listings()` | Get latest cryptocurrency listings with market data | 2¢ |
| `get_quotes(symbol)` | Get price quotes for specific cryptocurrencies | 1¢ |

## Parameters

### get_listings
- `limit` (number, optional) — Number of results (1-5000) (default: 20)
- `sort` (string, optional) — Sort by: market_cap, volume_24h, price (default: "market_cap")

### get_quotes
- `symbol` (string, required) — Comma-separated symbols (e.g. BTC,ETH)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COINMARKETCAP_API_KEY` | Yes | CoinMarketCap API key from [https://coinmarketcap.com/api/](https://coinmarketcap.com/api/) |

## Upstream API

- **Provider**: CoinMarketCap
- **Base URL**: https://pro-api.coinmarketcap.com/v1
- **Auth**: API key (header)
- **Docs**: https://coinmarketcap.com/api/documentation/v1/

## Deploy

### Docker

```bash
docker build -t settlegrid-coinmarketcap .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e COINMARKETCAP_API_KEY=xxx -p 3000:3000 settlegrid-coinmarketcap
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
