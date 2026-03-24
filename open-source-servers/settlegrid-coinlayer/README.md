# settlegrid-coinlayer

Coinlayer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coinlayer)

Cryptocurrency exchange rates and historical data via Coinlayer.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_live(target, symbols)` | Live crypto exchange rates | 2¢ |
| `get_historical(date, target)` | Historical rates for a date | 2¢ |
| `get_list()` | List supported cryptocurrencies | 1¢ |

## Parameters

### get_live
- `target` (string) — Target fiat currency (default USD)
- `symbols` (string) — Comma-separated crypto symbols (e.g. BTC,ETH)

### get_historical
- `date` (string, required) — Date (YYYY-MM-DD)
- `target` (string) — Target fiat currency (default USD)

### get_list

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COINLAYER_API_KEY` | Yes | Coinlayer API key from [https://coinlayer.com/product](https://coinlayer.com/product) |

## Upstream API

- **Provider**: Coinlayer
- **Base URL**: https://api.coinlayer.com
- **Auth**: API key required
- **Docs**: https://coinlayer.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-coinlayer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-coinlayer
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
