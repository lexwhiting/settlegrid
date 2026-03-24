# settlegrid-cardano

Blockfrost Cardano MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cardano)

Cardano blockchain data from Blockfrost — blocks, addresses, and assets.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BLOCKFROST_PROJECT_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest_block()` | Get the latest Cardano block | 2¢ |
| `get_address(address)` | Get Cardano address details | 2¢ |
| `get_asset(asset)` | Get native asset details by policy ID and asset name | 2¢ |

## Parameters

### get_address
- `address` (string, required)

### get_asset
- `asset` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BLOCKFROST_PROJECT_ID` | Yes | Free project ID from blockfrost.io |


## Upstream API

- **Provider**: Blockfrost
- **Base URL**: https://cardano-mainnet.blockfrost.io/api/v0
- **Auth**: Free API key required
- **Rate Limits**: 500 req/day (free)
- **Docs**: https://docs.blockfrost.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-cardano .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BLOCKFROST_PROJECT_ID=xxx -p 3000:3000 settlegrid-cardano
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
