# settlegrid-binance

Binance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-binance)

Crypto trading data, order books, and ticker prices via the public Binance API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ticker(symbol)` | 24hr ticker price change | 1¢ |
| `get_depth(symbol, limit)` | Order book depth | 1¢ |
| `get_klines(symbol, interval)` | Candlestick/kline data | 1¢ |

## Parameters

### get_ticker
- `symbol` (string, required) — Trading pair (e.g. BTCUSDT)

### get_depth
- `symbol` (string, required) — Trading pair (e.g. ETHUSDT)
- `limit` (number) — Depth limit (5, 10, 20, 50, default 20)

### get_klines
- `symbol` (string, required) — Trading pair
- `interval` (string, required) — Interval (1m, 5m, 1h, 1d, etc.)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Binance API — it is completely free.

## Upstream API

- **Provider**: Binance
- **Base URL**: https://api.binance.com/api/v3
- **Auth**: None required
- **Docs**: https://binance-docs.github.io/apidocs/spot/en/

## Deploy

### Docker

```bash
docker build -t settlegrid-binance .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-binance
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
