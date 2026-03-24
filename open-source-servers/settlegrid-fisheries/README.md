# settlegrid-fisheries

Global Fisheries Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fisheries)

Access global fisheries capture and aquaculture production data from FAOSTAT. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_catch(country?, species?, year?)` | Get fisheries catch data | 2¢ |
| `list_species()` | List major fish species | 1¢ |
| `get_aquaculture(country?)` | Get aquaculture production data | 2¢ |

## Parameters

### get_catch
- `country` (string) — Country name or ISO3 code
- `species` (string) — Species name (e.g. Tuna, Salmon, Shrimp)
- `year` (number) — Year to query (e.g. 2022)

### list_species

### get_aquaculture
- `country` (string) — Country name or ISO3 code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream FAOSTAT Fisheries API — it is completely free.

## Upstream API

- **Provider**: FAOSTAT Fisheries
- **Base URL**: https://www.fao.org/faostat/api/v1
- **Auth**: None required
- **Docs**: https://www.fao.org/fishery/en/statistics

## Deploy

### Docker

```bash
docker build -t settlegrid-fisheries .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fisheries
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
