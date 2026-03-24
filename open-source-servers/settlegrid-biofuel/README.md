# settlegrid-biofuel

Biofuel Production Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-biofuel)

Access global biofuel production and consumption data from World Bank indicators. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_production(country?, year?)` | Get biofuel production data | 2¢ |
| `get_consumption(country?, year?)` | Get biofuel consumption data | 2¢ |
| `list_countries()` | List major biofuel-producing countries | 1¢ |

## Parameters

### get_production
- `country` (string) — Country ISO2 code (e.g. US, BR, DE)
- `year` (number) — Year to query (e.g. 2022)

### get_consumption
- `country` (string) — Country ISO2 code
- `year` (number) — Year to query (e.g. 2022)

### list_countries

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
docker build -t settlegrid-biofuel .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-biofuel
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
