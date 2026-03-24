# settlegrid-sanctions-lists

Global Sanctions Lists MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sanctions-lists)

Search the US Consolidated Screening List for sanctioned entities, denied persons, and blocked parties. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_entities(query, source?, limit?)` | Search sanctioned entities | 2¢ |
| `get_entity(id)` | Get entity details by ID | 2¢ |
| `list_sources()` | List available screening list sources | 1¢ |

## Parameters

### search_entities
- `query` (string, required) — Name or keyword to search
- `source` (string) — Source list filter (SDN, DPL, ISN, etc.)
- `limit` (number) — Max results (default 20)

### get_entity
- `id` (string, required) — Entity ID

### list_sources

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Trade.gov CSL API — it is completely free.

## Upstream API

- **Provider**: Trade.gov CSL
- **Base URL**: https://api.trade.gov/gateway/v1/consolidated_screening_list
- **Auth**: None required
- **Docs**: https://developer.trade.gov/apis/consolidated-screening-list

## Deploy

### Docker

```bash
docker build -t settlegrid-sanctions-lists .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sanctions-lists
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
