# settlegrid-coinbase

Coinbase MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coinbase)

Cryptocurrency prices, exchange rates, and currency info from Coinbase

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_price(pair)` | Get current buy/sell price for a crypto pair | 1¢ |
| `get_currencies()` | List supported currencies | 1¢ |
| `get_exchange_rates()` | Get exchange rates for a currency | 1¢ |

## Parameters

### get_price
- `pair` (string, required) — Currency pair (e.g. BTC-USD)

### get_currencies

### get_exchange_rates
- `currency` (string, optional) — Base currency (default: "USD")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Coinbase API.

## Upstream API

- **Provider**: Coinbase
- **Base URL**: https://api.coinbase.com/v2
- **Auth**: None required
- **Docs**: https://docs.cloud.coinbase.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-coinbase .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-coinbase
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
