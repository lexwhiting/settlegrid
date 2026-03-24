# settlegrid-binance

Binance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-binance)

Cryptocurrency exchange data including prices, order books, and trades

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ticker(symbol)` | Get 24hr price change statistics | 1¢ |
| `get_klines(symbol, interval)` | Get candlestick/kline data | 2¢ |
| `get_orderbook(symbol)` | Get current order book depth | 1¢ |

## Parameters

### get_ticker
- `symbol` (string, required) — Trading pair (e.g. BTCUSDT)

### get_klines
- `symbol` (string, required) — Trading pair (e.g. BTCUSDT)
- `interval` (string, required) — Interval: 1m,5m,1h,1d,1w
- `limit` (number, optional) — Number of candles (1-1000) (default: 100)

### get_orderbook
- `symbol` (string, required) — Trading pair
- `limit` (number, optional) — Depth limit (5,10,20,50,100) (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Binance API.

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
