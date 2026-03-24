# settlegrid-coingecko

CoinGecko MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coingecko)

Cryptocurrency prices, market data, and exchange info via the free CoinGecko API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_price(ids, currency)` | Current price for coins | 1¢ |
| `get_coin(id)` | Detailed coin data | 1¢ |
| `get_trending()` | Trending coins | 1¢ |

## Parameters

### get_price
- `ids` (string, required) — Comma-separated coin IDs (e.g. bitcoin,ethereum)
- `currency` (string, required) — Target currency (e.g. usd)

### get_coin
- `id` (string, required) — Coin ID (e.g. bitcoin)

### get_trending

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CoinGecko API — it is completely free.

## Upstream API

- **Provider**: CoinGecko
- **Base URL**: https://api.coingecko.com/api/v3
- **Auth**: None required
- **Docs**: https://www.coingecko.com/en/api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-coingecko .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-coingecko
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
