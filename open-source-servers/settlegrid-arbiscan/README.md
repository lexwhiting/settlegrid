# settlegrid-arbiscan

Arbiscan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-arbiscan)

Arbitrum blockchain explorer — balances, transactions, and tokens.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ARBISCAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_balance(address)` | Get ETH balance for an Arbitrum address | 2¢ |
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
| `ARBISCAN_API_KEY` | Yes | Free key from arbiscan.io |


## Upstream API

- **Provider**: Arbiscan
- **Base URL**: https://api.arbiscan.io/api
- **Auth**: Free API key required
- **Rate Limits**: 5 req/sec
- **Docs**: https://docs.arbiscan.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-arbiscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ARBISCAN_API_KEY=xxx -p 3000:3000 settlegrid-arbiscan
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
