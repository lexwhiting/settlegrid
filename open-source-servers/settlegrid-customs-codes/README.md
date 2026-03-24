# settlegrid-customs-codes

Customs Codes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-customs-codes)

HS code lookup, tariff classification, and duty rate data.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_hs_code(query)` | Search HS codes | 1¢ |
| `get_hs_code(code)` | Get HS details | 1¢ |
| `get_tariff_rate(code, country)` | Get tariff rate | 2¢ |

## Parameters

### search_hs_code
- `query` (string, required) — Product description
### get_hs_code
- `code` (string, required) — HS code
### get_tariff_rate
- `code` (string, required) — HS code
- `country` (string, required) — ISO alpha-2 code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Built-in HS data + World Bank
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-customs-codes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-customs-codes
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
