# settlegrid-shipping-rates

Shipping Rates MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-shipping-rates)

Compare shipping rates across carriers and validate addresses.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rates(from_zip, to_zip, weight_oz)` | Get rates | 2¢ |
| `validate_address(street, city, state, zip)` | Validate address | 1¢ |

## Parameters

### get_rates
- `from_zip` (string, required) — Origin zip code
- `to_zip` (string, required) — Destination zip code
- `weight_oz` (number, required) — Weight in ounces
### validate_address
- `street` (string, required) — Street address
- `city` (string, required) — City
- `state` (string, required) — State
- `zip` (string, required) — Zip code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EASYPOST_API_KEY` | Yes | Free test key from easypost.com |

## Upstream API

- **Provider**: EasyPost
- **Auth**: Free test API key
- **Docs**: https://www.easypost.com/docs/api

## Deploy

### Docker
```bash
docker build -t settlegrid-shipping-rates .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-shipping-rates
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
