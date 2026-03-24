# settlegrid-fantom-explorer

Fantom Blockchain Explorer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fantom-explorer)

Query Fantom blockchain data via FTMScan API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ftm_balance(address)` | Get FTM balance for address | 1¢ |
| `get_ftm_transactions(address, limit?)` | Get Fantom transactions | 1¢ |

## Parameters

### get_ftm_balance
- `address` (string, required) — Fantom address (0x...)

### get_ftm_transactions
- `address` (string, required) — Fantom address
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FTMSCAN_API_KEY` | No | FTMScan API key from [https://ftmscan.com/apis](https://ftmscan.com/apis) |

## Upstream API

- **Provider**: FTMScan
- **Base URL**: https://api.ftmscan.com/api
- **Auth**: API key required
- **Docs**: https://docs.ftmscan.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-fantom-explorer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fantom-explorer
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
