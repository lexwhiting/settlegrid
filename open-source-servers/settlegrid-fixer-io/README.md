# settlegrid-fixer-io

Fixer.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fixer-io)

Foreign exchange rates, conversion, and time series via Fixer.io.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(base, symbols)` | Latest exchange rates | 2¢ |
| `get_historical(date, base)` | Historical rates for a date | 2¢ |
| `get_symbols()` | List supported currency symbols | 1¢ |

## Parameters

### get_latest
- `base` (string) — Base currency (default EUR)
- `symbols` (string) — Comma-separated target currencies

### get_historical
- `date` (string, required) — Date (YYYY-MM-DD)
- `base` (string) — Base currency

### get_symbols

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FIXER_API_KEY` | Yes | Fixer.io API key from [https://fixer.io/signup](https://fixer.io/signup) |

## Upstream API

- **Provider**: Fixer.io
- **Base URL**: https://data.fixer.io/api
- **Auth**: API key required
- **Docs**: https://fixer.io/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-fixer-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fixer-io
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
