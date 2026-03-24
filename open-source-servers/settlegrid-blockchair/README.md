# settlegrid-blockchair

Blockchair MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-blockchair)

Multi-chain blockchain explorer — Bitcoin, Ethereum, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_stats(chain)` | Get blockchain statistics for a chain | 1¢ |
| `get_block(chain, height)` | Get block details by height | 1¢ |
| `get_transaction(chain, hash)` | Get transaction details by hash | 1¢ |

## Parameters

### get_stats
- `chain` (string, required)

### get_block
- `chain` (string, required)
- `height` (number, required)

### get_transaction
- `chain` (string, required)
- `hash` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Blockchair
- **Base URL**: https://api.blockchair.com
- **Auth**: None required
- **Rate Limits**: 30 req/min (free)
- **Docs**: https://blockchair.com/api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-blockchair .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-blockchair
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
