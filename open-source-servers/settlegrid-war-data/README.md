# settlegrid-war-data

Conflict & War Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-war-data)

Access armed conflict data via UCDP API (Uppsala Conflict Data Program). Get conflicts, battle deaths, and country data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_conflicts(country?, year?)` | Get armed conflicts | 1¢ |
| `get_battle_deaths(conflict_id)` | Get battle-related deaths | 2¢ |
| `list_countries()` | List countries with conflict data | 1¢ |

## Parameters

### get_conflicts
- `country` (string) — Country name (e.g. "Syria", "Ukraine")
- `year` (string) — Year (e.g. "2023")

### get_battle_deaths
- `conflict_id` (string, required) — UCDP conflict ID

### list_countries

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UCDP API API — it is completely free.

## Upstream API

- **Provider**: UCDP API
- **Base URL**: https://ucdpapi.pcr.uu.se/api
- **Auth**: None required
- **Docs**: https://ucdp.uu.se/apidocs/

## Deploy

### Docker

```bash
docker build -t settlegrid-war-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-war-data
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
