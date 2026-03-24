# settlegrid-commodities-api

Commodities API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-commodities-api)

Commodity prices for oil, gas, grains, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(base, symbols)` | Latest commodity prices | 2¢ |
| `get_historical(date, base, symbols)` | Historical commodity prices | 2¢ |
| `get_symbols()` | List available commodity symbols | 1¢ |

## Parameters

### get_latest
- `base` (string) — Base currency (default USD)
- `symbols` (string) — Commodity symbols (e.g. BRENTOIL,WHEAT)

### get_historical
- `date` (string, required) — Date (YYYY-MM-DD)
- `base` (string) — Base currency
- `symbols` (string) — Commodity symbols

### get_symbols

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COMMODITIES_API_KEY` | Yes | Commodities API API key from [https://commodities-api.com/pricing](https://commodities-api.com/pricing) |

## Upstream API

- **Provider**: Commodities API
- **Base URL**: https://commodities-api.com/api
- **Auth**: API key required
- **Docs**: https://commodities-api.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-commodities-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-commodities-api
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
