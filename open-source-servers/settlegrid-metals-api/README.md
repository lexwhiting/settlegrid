# settlegrid-metals-api

Metals API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-metals-api)

Precious metal and commodity prices with real-time and historical rates.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(base, symbols)` | Latest metal prices | 2¢ |
| `get_historical(date, base, symbols)` | Historical metal prices | 2¢ |
| `get_symbols()` | List available metal symbols | 1¢ |

## Parameters

### get_latest
- `base` (string) — Base currency (default USD)
- `symbols` (string) — Metal symbols (e.g. XAU,XAG)

### get_historical
- `date` (string, required) — Date (YYYY-MM-DD)
- `base` (string) — Base currency
- `symbols` (string) — Metal symbols

### get_symbols

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `METALS_API_KEY` | Yes | Metals API API key from [https://metals-api.com/pricing](https://metals-api.com/pricing) |

## Upstream API

- **Provider**: Metals API
- **Base URL**: https://metals-api.com/api
- **Auth**: API key required
- **Docs**: https://metals-api.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-metals-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-metals-api
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
