# settlegrid-blockchain-info

Blockchain.info MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-blockchain-info)

Bitcoin blockchain data — blocks, transactions, and addresses.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_address(address)` | Get Bitcoin address balance and transactions | 1¢ |
| `get_block(hash)` | Get Bitcoin block details by hash | 1¢ |
| `get_ticker()` | Get current BTC exchange rates | 1¢ |

## Parameters

### get_address
- `address` (string, required)

### get_block
- `hash` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Blockchain.com
- **Base URL**: https://blockchain.info
- **Auth**: None required
- **Rate Limits**: 100 req/5min
- **Docs**: https://www.blockchain.com/api/blockchain_api

## Deploy

### Docker

```bash
docker build -t settlegrid-blockchain-info .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-blockchain-info
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
