# settlegrid-solscan

Solscan MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-solscan)

Solana blockchain explorer — accounts, transactions, and tokens.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_account(address)` | Get Solana account details | 1¢ |
| `get_transaction(signature)` | Get Solana transaction details | 1¢ |
| `get_token_holders(token_address)` | Get top holders of a Solana token | 1¢ |

## Parameters

### get_account
- `address` (string, required)

### get_transaction
- `signature` (string, required)

### get_token_holders
- `token_address` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Solscan
- **Base URL**: https://public-api.solscan.io
- **Auth**: None required
- **Rate Limits**: 150 req/30sec
- **Docs**: https://public-api.solscan.io/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-solscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-solscan
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
