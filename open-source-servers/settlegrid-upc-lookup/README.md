# settlegrid-upc-lookup

UPC Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Look up product information by UPC, EAN, or ISBN barcode.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_upc(upc)` | Look up product by UPC code | 1¢ |
| `lookup_ean(ean)` | Look up product by EAN code | 1¢ |
| `lookup_isbn(isbn)` | Look up book by ISBN | 1¢ |
| `search_product(query)` | Search products by name | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `UPC_API_KEY` | Yes | UPC API key from [upcdatabase.org](https://upcdatabase.org/) |

## Upstream API

- **Provider**: UPC Database
- **Base URL**: https://api.upcdatabase.org
- **Auth**: API key (header)
- **Docs**: https://upcdatabase.org/api

## Deploy

### Docker
```bash
docker build -t settlegrid-upc-lookup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e UPC_API_KEY=xxx -p 3000:3000 settlegrid-upc-lookup
```

### Vercel
```bash
npm run build && vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
