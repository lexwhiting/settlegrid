# settlegrid-finland-stat

Finnish Statistics MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-finland-stat)

Access Finnish official statistics from Statistics Finland (PXWeb).

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_databases()` | List database hierarchy | 1¢ |
| `get_table_info(path)` | Get table info | 1¢ |
| `search_tables(query)` | Search tables | 1¢ |

## Parameters

### list_databases

### get_table_info
- `path` (string, required) — Table path in hierarchy

### search_tables
- `query` (string, required) — Search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Statistics Finland PXWeb API — it is completely free.

## Upstream API

- **Provider**: Statistics Finland PXWeb
- **Base URL**: https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin
- **Auth**: None required
- **Docs**: https://pxdata.stat.fi/PXWeb/api/v1/en/StatFin

## Deploy

### Docker

```bash
docker build -t settlegrid-finland-stat .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-finland-stat
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
