# settlegrid-barcode-lookup

Barcode Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-barcode-lookup)

Look up product information by UPC, EAN, or ISBN barcode via Barcode Lookup.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + BARCODE_LOOKUP_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_barcode(barcode)` | Get product info by barcode number | 2¢ |
| `search_products(query)` | Search products by name or keyword | 2¢ |

## Parameters

### lookup_barcode
- `barcode` (string, required) — UPC, EAN, or ISBN barcode number

### search_products
- `query` (string, required) — Product name or keyword

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `BARCODE_LOOKUP_API_KEY` | Yes | Barcode Lookup API key |


## Upstream API

- **Provider**: Barcode Lookup
- **Base URL**: https://api.barcodelookup.com/v3
- **Auth**: API key required (query param)
- **Rate Limits**: Free trial available
- **Docs**: https://www.barcodelookup.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-barcode-lookup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e BARCODE_LOOKUP_API_KEY=xxx -p 3000:3000 settlegrid-barcode-lookup
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
