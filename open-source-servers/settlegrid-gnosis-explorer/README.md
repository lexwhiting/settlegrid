# settlegrid-gnosis-explorer

Gnosis Chain Explorer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gnosis-explorer)

Query Gnosis Chain (xDai) blockchain data via Blockscout API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_gnosis_address(address)` | Get Gnosis address info | 1¢ |
| `get_gnosis_tx(hash)` | Get Gnosis transaction details | 1¢ |

## Parameters

### get_gnosis_address
- `address` (string, required) — Gnosis address (0x...)

### get_gnosis_tx
- `hash` (string, required) — Transaction hash

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Gnosis Blockscout API — it is completely free.

## Upstream API

- **Provider**: Gnosis Blockscout
- **Base URL**: https://gnosis.blockscout.com/api/v2
- **Auth**: None required
- **Docs**: https://gnosis.blockscout.com/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-gnosis-explorer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gnosis-explorer
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
