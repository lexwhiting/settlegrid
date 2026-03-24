# settlegrid-open-food-facts

Open Food Facts MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-food-facts)

Global food product database with nutrition data, ingredients, and allergens.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_products(query)` | Search food products by name | 1¢ |
| `get_product(barcode)` | Get food product details by barcode | 1¢ |

## Parameters

### search_products
- `query` (string, required)

### get_product
- `barcode` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Open Food Facts
- **Base URL**: https://world.openfoodfacts.org
- **Auth**: None required
- **Rate Limits**: ~100 req/min
- **Docs**: https://openfoodfacts.github.io/openfoodfacts-server/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-open-food-facts .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-food-facts
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
