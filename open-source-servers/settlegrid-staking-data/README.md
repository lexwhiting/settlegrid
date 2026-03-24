# settlegrid-staking-data

Staking Yields & Validator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-staking-data)

Get staking APY yields and validator data across proof-of-stake chains. Uses free DefiLlama yields API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_yields` | Top staking yields across chains | 1¢ |
| `get_validators(chain)` | Validator/staking info for a chain | 2¢ |

## Parameters

### get_yields
No parameters required.

### get_validators
- `chain` (string, required) — Chain name (e.g. "ethereum", "solana", "cosmos")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: DefiLlama Yields
- **Base URL**: https://yields.llama.fi
- **Auth**: None required
- **Docs**: https://defillama.com/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-staking-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-staking-data
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
