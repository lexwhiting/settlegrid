# settlegrid-defi-pulse

DeFi Protocol TVL MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-defi-pulse)

Get total value locked (TVL) data across DeFi protocols. Wraps the free DefiLlama API with zero upstream costs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_protocols` | List all DeFi protocols with TVL | 1¢ |
| `get_tvl(protocol)` | Current TVL for a specific protocol | 1¢ |
| `get_history(protocol)` | Historical TVL data for a protocol | 2¢ |

## Parameters

### get_protocols
No parameters required. Returns top protocols by TVL.

### get_tvl
- `protocol` (string, required) — Protocol slug (e.g. "aave", "uniswap")

### get_history
- `protocol` (string, required) — Protocol slug (e.g. "aave", "uniswap")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DefiLlama API — it is completely free.

## Upstream API

- **Provider**: DefiLlama
- **Base URL**: https://api.llama.fi
- **Auth**: None required
- **Rate Limits**: Reasonable use expected
- **Docs**: https://defillama.com/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-defi-pulse .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-defi-pulse
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
