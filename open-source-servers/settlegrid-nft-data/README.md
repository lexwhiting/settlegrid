# settlegrid-nft-data

NFT Collection Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nft-data)

Get NFT collection data including floor prices, volume, and holder statistics. Uses free NFT data APIs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_collection(slug)` | Collection stats and metadata | 2¢ |
| `get_floor_price(slug)` | Current floor price | 1¢ |

## Parameters

### get_collection
- `slug` (string, required) — Collection slug (e.g. "bored-ape-yacht-club")

### get_floor_price
- `slug` (string, required) — Collection slug (e.g. "cryptopunks")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: CoinGecko NFT API
- **Base URL**: https://api.coingecko.com/api/v3
- **Auth**: None required for free tier
- **Docs**: https://www.coingecko.com/en/api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-nft-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nft-data
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
