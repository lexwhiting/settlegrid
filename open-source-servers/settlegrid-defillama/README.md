# settlegrid-defillama

DeFi Llama MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-defillama)

DeFi TVL data, protocol stats, and chain analytics from DefiLlama.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_protocol_tvl(protocol)` | Get protocol TVL data | 1¢ |
| `get_chain_tvl(chain)` | Get chain TVL data | 1¢ |
| `list_protocols()` | List all DeFi protocols | 1¢ |

## Parameters

### get_protocol_tvl
- `protocol` (string, required) — Protocol slug (e.g. aave, uniswap)

### get_chain_tvl
- `chain` (string, required) — Chain name (e.g. Ethereum, BSC)

### list_protocols

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DefiLlama API — it is completely free.

## Upstream API

- **Provider**: DefiLlama
- **Base URL**: https://api.llama.fi
- **Auth**: None required
- **Docs**: https://defillama.com/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-defillama .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-defillama
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
