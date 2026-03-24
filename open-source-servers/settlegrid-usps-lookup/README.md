# settlegrid-usps-lookup

ZIP Code Lookup MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-usps-lookup)

US and international postal code lookup via Zippopotam.us.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_zip(zip)` | Get city, state, and coordinates for a US ZIP code | 1¢ |
| `lookup_international(country, code)` | Look up postal code in any country (ISO 2-letter code) | 1¢ |

## Parameters

### lookup_zip
- `zip` (string, required)

### lookup_international
- `country` (string, required)
- `code` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Zippopotam.us
- **Base URL**: https://api.zippopotam.us
- **Auth**: None required
- **Rate Limits**: No published limit (no key)
- **Docs**: https://api.zippopotam.us

## Deploy

### Docker

```bash
docker build -t settlegrid-usps-lookup .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-usps-lookup
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
