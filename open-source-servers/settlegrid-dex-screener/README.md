# settlegrid-dex-screener

DEX Screener MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dex-screener)

Decentralized exchange token prices, pairs, and liquidity data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_pairs(q)` | Search for trading pairs by token name or address | 1¢ |
| `get_token_pairs(address)` | Get all pairs for a specific token address | 1¢ |

## Parameters

### search_pairs
- `q` (string, required) — Search query (token name or address)

### get_token_pairs
- `address` (string, required) — Token contract address

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DEX Screener API.

## Upstream API

- **Provider**: DEX Screener
- **Base URL**: https://api.dexscreener.com/latest/dex
- **Auth**: None required
- **Docs**: https://docs.dexscreener.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-dex-screener .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dex-screener
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
