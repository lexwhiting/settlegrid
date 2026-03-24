# settlegrid-itu-telecom

ITU Telecom Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-itu-telecom)

Access ITU telecommunications statistics via the ITU DataHub API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_indicator(indicator, country?)` | Get telecom indicator data | 2¢ |
| `list_indicators()` | List available ITU indicators | 1¢ |
| `list_countries()` | List available countries | 1¢ |

## Parameters

### get_indicator
- `indicator` (string, required) — Indicator code (e.g. "internet_users_pct")
- `country` (string) — ISO3 country code

### list_indicators

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ITU DataHub API API — it is completely free.

## Upstream API

- **Provider**: ITU DataHub API
- **Base URL**: https://datahub.itu.int/api
- **Auth**: None required
- **Docs**: https://datahub.itu.int/

## Deploy

### Docker

```bash
docker build -t settlegrid-itu-telecom .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-itu-telecom
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
