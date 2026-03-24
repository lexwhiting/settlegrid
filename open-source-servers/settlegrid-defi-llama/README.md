# settlegrid-defi-llama

DefiLlama MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-defi-llama)

DeFi TVL, protocol data, and yield aggregation from DefiLlama.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_protocols()` | Get TVL data for all DeFi protocols | 1¢ |
| `get_protocol(protocol)` | Get detailed TVL data for a specific protocol | 1¢ |
| `get_chains()` | Get TVL data grouped by chain | 1¢ |

## Parameters

### get_protocol
- `protocol` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: DefiLlama
- **Base URL**: https://api.llama.fi
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://defillama.com/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-defi-llama .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-defi-llama
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
