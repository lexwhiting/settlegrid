# settlegrid-wipo-patents

WIPO Patent Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wipo-patents)

Access WIPO intellectual property statistics and patent data via the WIPO IP Statistics API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_patent_stats(country, year?)` | Get patent statistics for a country | 2¢ |
| `list_countries()` | List countries with patent data | 1¢ |
| `get_trend(country, indicator)` | Get patent trend for a country and indicator | 2¢ |

## Parameters

### get_patent_stats
- `country` (string, required) — ISO2 country code (e.g. US, CN, JP)
- `year` (string) — Year (e.g. 2022)

### list_countries

### get_trend
- `country` (string, required) — ISO2 country code
- `indicator` (string, required) — Indicator (e.g. patent_applications, trademark_registrations)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WIPO IP Statistics API API — it is completely free.

## Upstream API

- **Provider**: WIPO IP Statistics API
- **Base URL**: https://www3.wipo.int/ipstats/api
- **Auth**: None required
- **Docs**: https://www.wipo.int/ipstats/en/

## Deploy

### Docker

```bash
docker build -t settlegrid-wipo-patents .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-wipo-patents
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
