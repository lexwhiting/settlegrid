# settlegrid-tezos

TzKT Tezos MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-tezos)

Tezos blockchain data from TzKT — accounts, operations, and baking.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_account(address)` | Get Tezos account details | 1¢ |
| `get_head()` | Get the latest Tezos block | 1¢ |
| `get_operations()` | Get recent Tezos operations | 1¢ |

## Parameters

### get_account
- `address` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: TzKT
- **Base URL**: https://api.tzkt.io/v1
- **Auth**: None required
- **Rate Limits**: 10 req/sec
- **Docs**: https://api.tzkt.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-tezos .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-tezos
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
