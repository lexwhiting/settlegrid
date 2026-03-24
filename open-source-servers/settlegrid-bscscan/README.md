# settlegrid-bscscan

BscScan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bscscan)

Binance Smart Chain explorer — balances, transactions, and tokens.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BSCSCAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_balance(address)` | Get BNB balance for an address | 2¢ |
| `get_transactions(address)` | Get transaction list for an address | 2¢ |

## Parameters

### get_balance
- `address` (string, required)

### get_transactions
- `address` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BSCSCAN_API_KEY` | Yes | Free key from bscscan.com |


## Upstream API

- **Provider**: BscScan
- **Base URL**: https://api.bscscan.com/api
- **Auth**: Free API key required
- **Rate Limits**: 5 req/sec
- **Docs**: https://docs.bscscan.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-bscscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BSCSCAN_API_KEY=xxx -p 3000:3000 settlegrid-bscscan
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
