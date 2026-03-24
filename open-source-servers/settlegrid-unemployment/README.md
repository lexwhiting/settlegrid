# settlegrid-unemployment

Unemployment Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unemployment)

Unemployment rates worldwide via World Bank indicators. Historical trends and country rankings.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_rate(country, year?)` | Get unemployment rate for country | 1¢ |
| `get_historical(country, years?)` | Get historical unemployment | 1¢ |
| `get_rankings(year?)` | Get unemployment rankings | 1¢ |

## Parameters

### get_rate
- `country` (string, required) — Country code (US, GB, DE, JP, etc.)
- `year` (string) — Specific year (default: latest)

### get_historical
- `country` (string, required) — Country code
- `years` (number) — Years of history (default: 10)

### get_rankings
- `year` (string) — Year for rankings (default: latest)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Bank API — it is completely free.

## Upstream API

- **Provider**: World Bank
- **Base URL**: https://api.worldbank.org/v2
- **Auth**: None required
- **Docs**: https://datahelpdesk.worldbank.org/knowledgebase/articles/889392

## Deploy

### Docker

```bash
docker build -t settlegrid-unemployment .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-unemployment
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
