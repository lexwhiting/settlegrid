# settlegrid-coingecko-markets

CoinGecko Markets MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coingecko-markets)

Crypto market data, trending coins, and exchange info from CoinGecko.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_trending()` | Get trending cryptocurrencies | 1¢ |
| `get_global_market()` | Get global crypto market data | 1¢ |
| `get_exchanges(limit?)` | Get top exchanges by volume | 1¢ |

## Parameters

### get_trending

### get_global_market

### get_exchanges
- `limit` (number) — Number of exchanges (default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CoinGecko API — it is completely free.

## Upstream API

- **Provider**: CoinGecko
- **Base URL**: https://api.coingecko.com/api/v3
- **Auth**: None required
- **Docs**: https://docs.coingecko.com/reference/introduction

## Deploy

### Docker

```bash
docker build -t settlegrid-coingecko-markets .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-coingecko-markets
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
