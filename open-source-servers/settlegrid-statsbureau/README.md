# settlegrid-statsbureau

StatBureau MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-statsbureau)

Global inflation, CPI, and consumer price statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_inflation(country)` | Inflation data by country | 2¢ |
| `get_cpi(country)` | Consumer Price Index data | 2¢ |
| `get_countries()` | List supported countries | 1¢ |

## Parameters

### get_inflation
- `country` (string, required) — Country name (e.g. "united-states")

### get_cpi
- `country` (string, required) — Country name

### get_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `STATBUREAU_API_KEY` | Yes | StatBureau API key from [https://www.statbureau.org/en/api](https://www.statbureau.org/en/api) |

## Upstream API

- **Provider**: StatBureau
- **Base URL**: https://www.statbureau.org/api/v1
- **Auth**: API key required
- **Docs**: https://www.statbureau.org/en/api

## Deploy

### Docker

```bash
docker build -t settlegrid-statsbureau .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-statsbureau
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
