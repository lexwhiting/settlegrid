# settlegrid-heritage-economic

Economic Freedom Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-heritage-economic)

Access Economic Freedom Index data via World Bank ease of doing business and trade indicators.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_score(country, year?)` | Get trade freedom indicator | 2¢ |
| `list_countries(year?)` | List countries | 1¢ |
| `get_rankings(year?)` | Get economic freedom rankings | 2¢ |

## Parameters

### get_score
- `country` (string, required) — ISO country code
- `year` (string) — Year

### list_countries
- `year` (string) — Year filter

### get_rankings
- `year` (string) — Year

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API (Economic Freedom proxy) API — it is completely free.

## Upstream API

- **Provider**: World Bank API (Economic Freedom proxy)
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://www.heritage.org/index/

## Deploy

### Docker

```bash
docker build -t settlegrid-heritage-economic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-heritage-economic
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
