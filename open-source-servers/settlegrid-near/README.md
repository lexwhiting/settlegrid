# settlegrid-near

NEAR Blocks MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-near)

NEAR Protocol blockchain explorer — accounts, blocks, and transactions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_account(account_id)` | Get NEAR account details | 1¢ |
| `get_blocks()` | Get recent NEAR blocks | 1¢ |
| `get_txns()` | Get recent NEAR transactions | 1¢ |

## Parameters

### get_account
- `account_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NEARBlocks
- **Base URL**: https://api.nearblocks.io/v1
- **Auth**: None required
- **Rate Limits**: 6 req/sec
- **Docs**: https://api.nearblocks.io/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-near .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-near
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
