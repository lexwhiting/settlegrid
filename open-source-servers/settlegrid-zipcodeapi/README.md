# settlegrid-zipcodeapi

ZipCodeAPI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-zipcodeapi)

Look up US ZIP code data, distances, and nearby codes via ZipCodeAPI with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ZIPCODE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_zip_info(zip)` | Get info for a US ZIP code | 2¢ |
| `get_distance(zip1, zip2)` | Get distance between two ZIP codes | 2¢ |

## Parameters

### get_zip_info
- `zip` (string, required) — 5-digit US ZIP code

### get_distance
- `zip1` (string, required) — First ZIP code
- `zip2` (string, required) — Second ZIP code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ZIPCODE_API_KEY` | Yes | ZipCodeAPI API key |


## Upstream API

- **Provider**: ZipCodeAPI
- **Base URL**: https://www.zipcodeapi.com/rest
- **Auth**: Free API key required
- **Rate Limits**: 10 req/hr (free)
- **Docs**: https://www.zipcodeapi.com/API

## Deploy

### Docker

```bash
docker build -t settlegrid-zipcodeapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ZIPCODE_API_KEY=xxx -p 3000:3000 settlegrid-zipcodeapi
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
