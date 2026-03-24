# settlegrid-tron-explorer

Tron Blockchain Explorer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tron-explorer)

Query Tron blockchain data — accounts, transactions, tokens via TronGrid API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_tron_account(address)` | Get Tron account info | 1¢ |
| `get_tron_transactions(address, limit?)` | Get Tron account transactions | 1¢ |

## Parameters

### get_tron_account
- `address` (string, required) — Tron address (T...)

### get_tron_transactions
- `address` (string, required) — Tron address
- `limit` (number) — Max results (default 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TronGrid API — it is completely free.

## Upstream API

- **Provider**: TronGrid
- **Base URL**: https://api.trongrid.io
- **Auth**: None required
- **Docs**: https://developers.tron.network/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-tron-explorer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tron-explorer
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
