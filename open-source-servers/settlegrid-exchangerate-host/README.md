# settlegrid-exchangerate-host

ExchangeRate.host MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-exchangerate-host)

Free foreign exchange rates, crypto rates, and currency conversion

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest()` | Get latest exchange rates | 1¢ |
| `convert(from, to, amount)` | Convert between currencies | 1¢ |

## Parameters

### get_latest
- `base` (string, optional) — Base currency (default USD) (default: "USD")
- `symbols` (string, optional) — Target currencies comma-separated

### convert
- `from` (string, required) — Source currency
- `to` (string, required) — Target currency
- `amount` (number, required) — Amount to convert

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ExchangeRate.host API.

## Upstream API

- **Provider**: ExchangeRate.host
- **Base URL**: https://api.exchangerate.host
- **Auth**: None required
- **Docs**: https://exchangerate.host/#/

## Deploy

### Docker

```bash
docker build -t settlegrid-exchangerate-host .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-exchangerate-host
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
