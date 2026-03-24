# settlegrid-usps-zipcode

Zippopotamus MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usps-zipcode)

Free zip code lookup with city, state, country, and coordinates

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_zip(country, code)` | Get location info for a zip/postal code | 1¢ |

## Parameters

### lookup_zip
- `country` (string, required) — Country code (e.g. us, de, fr)
- `code` (string, required) — Zip/postal code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Zippopotamus API.

## Upstream API

- **Provider**: Zippopotamus
- **Base URL**: https://api.zippopotam.us
- **Auth**: None required
- **Docs**: https://www.zippopotam.us/

## Deploy

### Docker

```bash
docker build -t settlegrid-usps-zipcode .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usps-zipcode
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
