# settlegrid-usda-markets

USDA Farmers Markets MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usda-markets)

Search for farmers markets and local food sources across the United States via USDA.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_markets(zip)` | Search farmers markets by zip code | 1¢ |
| `get_market(id)` | Get details for a specific farmers market | 1¢ |

## Parameters

### search_markets
- `zip` (string, required) — US zip code (e.g. "90210")

### get_market
- `id` (string, required) — Market ID from search results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: USDA
- **Base URL**: https://search.ams.usda.gov/farmersmarkets/v1/data.svc
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://search.ams.usda.gov/farmersmarkets/v1/svcdesc.html

## Deploy

### Docker

```bash
docker build -t settlegrid-usda-markets .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usda-markets
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
