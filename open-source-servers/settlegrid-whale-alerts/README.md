# settlegrid-whale-alerts

Crypto Whale Transaction MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-whale-alerts)

Track large cryptocurrency transactions. Uses free Blockchain.com API for Bitcoin whale movements.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recent(chain)` | Recent large transactions | 2¢ |
| `get_whale_transactions(min_usd)` | Filter transactions by minimum USD value | 2¢ |

## Parameters

### get_recent
- `chain` (string, optional) — Chain name, defaults to "bitcoin"

### get_whale_transactions
- `min_usd` (number, optional) — Minimum transaction value in USD (default: 1000000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: Blockchain.com
- **Base URL**: https://blockchain.info
- **Auth**: None required
- **Docs**: https://www.blockchain.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-whale-alerts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-whale-alerts
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
