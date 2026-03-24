# settlegrid-exchangerate-api

ExchangeRate-API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-exchangerate-api)

Free currency exchange rate API with 160+ currencies

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(base)` | Get latest exchange rates for a base currency | 1¢ |

## Parameters

### get_latest
- `base` (string, required) — Base currency code (e.g. USD)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ExchangeRate-API API.

## Upstream API

- **Provider**: ExchangeRate-API
- **Base URL**: https://open.er-api.com/v6
- **Auth**: None required
- **Docs**: https://www.exchangerate-api.com/docs/free

## Deploy

### Docker

```bash
docker build -t settlegrid-exchangerate-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-exchangerate-api
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
