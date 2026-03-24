# settlegrid-layer2-data

Layer 2 Scaling Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-layer2-data)

Get TVL, fee, and usage data for Ethereum Layer 2 scaling solutions. Uses free DefiLlama API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_l2s` | List all L2 networks with TVL | 1¢ |
| `get_tvl(l2)` | TVL data for a specific L2 | 1¢ |
| `get_fees(l2)` | Fee data for a specific L2 | 2¢ |

## Parameters

### get_l2s
No parameters required.

### get_tvl
- `l2` (string, required) — L2 chain name (e.g. "Arbitrum", "Optimism", "Base")

### get_fees
- `l2` (string, required) — L2 chain name (e.g. "Arbitrum", "Optimism", "Base")

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
docker build -t settlegrid-layer2-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-layer2-data
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
