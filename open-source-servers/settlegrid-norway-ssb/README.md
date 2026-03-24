# settlegrid-norway-ssb

Norwegian Statistics (SSB) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-norway-ssb)

Access Norwegian official statistics from SSB (Statistics Norway).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_subjects()` | List statistical subjects | 1¢ |
| `get_table_info(tableId)` | Get table info | 1¢ |
| `search_tables(query)` | Search tables | 1¢ |

## Parameters

### list_subjects

### get_table_info
- `tableId` (string, required) — SSB table ID

### search_tables
- `query` (string, required) — Search term

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SSB API API — it is completely free.

## Upstream API

- **Provider**: SSB API
- **Base URL**: https://data.ssb.no/api/v0/en/table
- **Auth**: None required
- **Docs**: https://www.ssb.no/en/omssb/tjenester-og-verktoy/api

## Deploy

### Docker

```bash
docker build -t settlegrid-norway-ssb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-norway-ssb
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
