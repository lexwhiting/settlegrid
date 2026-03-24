# settlegrid-coinpaprika

Coinpaprika MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-coinpaprika)

Cryptocurrency market data, tickers, and coin details from Coinpaprika.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_coins()` | Get list of all cryptocurrencies | 1¢ |
| `get_ticker(coin_id)` | Get ticker data for a specific coin | 1¢ |
| `search_coins(query)` | Search coins by name | 1¢ |

## Parameters

### get_ticker
- `coin_id` (string, required)

### search_coins
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Coinpaprika
- **Base URL**: https://api.coinpaprika.com/v1
- **Auth**: None required
- **Rate Limits**: 10 req/sec
- **Docs**: https://api.coinpaprika.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-coinpaprika .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-coinpaprika
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
