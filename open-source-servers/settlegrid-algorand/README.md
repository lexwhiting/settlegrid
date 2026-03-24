# settlegrid-algorand

Algorand MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-algorand)

Algorand blockchain data — accounts, blocks, and transactions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_account(address)` | Get Algorand account details | 1¢ |
| `get_status()` | Get Algorand node and network status | 1¢ |
| `get_block(round)` | Get Algorand block by round number | 1¢ |

## Parameters

### get_account
- `address` (string, required)

### get_block
- `round` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: AlgoNode
- **Base URL**: https://mainnet-api.algonode.cloud/v2
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://developer.algorand.org/docs/rest-apis/algod/

## Deploy

### Docker

```bash
docker build -t settlegrid-algorand .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-algorand
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
