# settlegrid-futures-data

Futures Market Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-futures-data)

Futures quotes and contract data for commodities, indices, and currencies via CME Group.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_quotes(category?)` | Get futures quotes by category | 1¢ |
| `get_contract(symbol)` | Get specific contract details | 1¢ |
| `list_categories()` | List available futures categories | 1¢ |

## Parameters

### get_quotes
- `category` (string) — Category: agriculture, energy, metals, indices, fx

### get_contract
- `symbol` (string, required) — Futures contract symbol (e.g., ES, CL, GC)

### list_categories

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CME Group API — it is completely free.

## Upstream API

- **Provider**: CME Group
- **Base URL**: https://www.cmegroup.com/CmeWS/mvc/Quotes
- **Auth**: None required
- **Docs**: https://www.cmegroup.com/market-data.html

## Deploy

### Docker

```bash
docker build -t settlegrid-futures-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-futures-data
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
