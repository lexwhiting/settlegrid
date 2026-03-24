# settlegrid-moonbeam-explorer

Moonbeam Blockchain Explorer MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-moonbeam-explorer)

Query Moonbeam blockchain data via Blockscout API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_moonbeam_address(address)` | Get Moonbeam address info | 1¢ |
| `get_moonbeam_block(number)` | Get Moonbeam block info | 1¢ |

## Parameters

### get_moonbeam_address
- `address` (string, required) — Moonbeam address (0x...)

### get_moonbeam_block
- `number` (number, required) — Block number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Moonbeam Blockscout API — it is completely free.

## Upstream API

- **Provider**: Moonbeam Blockscout
- **Base URL**: https://moonbeam.blockscout.com/api/v2
- **Auth**: None required
- **Docs**: https://moonbeam.blockscout.com/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-moonbeam-explorer .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-moonbeam-explorer
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
