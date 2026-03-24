# settlegrid-ofac

OFAC SDN List MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ofac)

Search the OFAC Specially Designated Nationals (SDN) list via Trade.gov. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sdn(query, type?, limit?)` | Search SDN list entries | 2¢ |
| `get_entry(id)` | Get an SDN entry by ID | 2¢ |
| `get_stats()` | Get SDN list statistics | 1¢ |

## Parameters

### search_sdn
- `query` (string, required) — Name or keyword to search
- `type` (string) — Entity type: individual, entity, vessel, aircraft
- `limit` (number) — Max results (default 20)

### get_entry
- `id` (string, required) — Entry ID

### get_stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Trade.gov (OFAC filter) API — it is completely free.

## Upstream API

- **Provider**: Trade.gov (OFAC filter)
- **Base URL**: https://api.trade.gov/gateway/v1/consolidated_screening_list
- **Auth**: None required
- **Docs**: https://developer.trade.gov/apis/consolidated-screening-list

## Deploy

### Docker

```bash
docker build -t settlegrid-ofac .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ofac
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
