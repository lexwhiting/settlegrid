# settlegrid-dex-data

Decentralized Exchange Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dex-data)

Get DEX volume, pool, and protocol data. Wraps the free DefiLlama DEX API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_pools(chain)` | Top liquidity pools on a chain | 2¢ |
| `get_swaps(pool)` | DEX volume data for a protocol | 2¢ |

## Parameters

### get_pools
- `chain` (string, optional) — Chain name (e.g. "ethereum", "bsc"). Defaults to all chains.

### get_swaps
- `pool` (string, required) — DEX protocol slug (e.g. "uniswap", "sushiswap")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: DefiLlama
- **Base URL**: https://api.llama.fi
- **Auth**: None required
- **Docs**: https://defillama.com/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-dex-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dex-data
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
