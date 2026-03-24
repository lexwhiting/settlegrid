# settlegrid-kraken

Kraken MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-kraken)

Crypto market data, OHLC, and ticker info via the public Kraken API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ticker(pair)` | Ticker info for trading pair | 1¢ |
| `get_ohlc(pair, interval)` | OHLC candlestick data | 1¢ |
| `get_assets()` | List available assets | 1¢ |

## Parameters

### get_ticker
- `pair` (string, required) — Trading pair (e.g. XBTUSD)

### get_ohlc
- `pair` (string, required) — Trading pair (e.g. XBTUSD)
- `interval` (number) — Interval in minutes (1, 5, 15, 30, 60, 240, 1440, default 60)

### get_assets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Kraken API — it is completely free.

## Upstream API

- **Provider**: Kraken
- **Base URL**: https://api.kraken.com/0/public
- **Auth**: None required
- **Docs**: https://docs.kraken.com/rest/

## Deploy

### Docker

```bash
docker build -t settlegrid-kraken .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-kraken
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
