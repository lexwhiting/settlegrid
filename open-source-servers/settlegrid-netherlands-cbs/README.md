# settlegrid-netherlands-cbs

Dutch Statistics (CBS) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-netherlands-cbs)

Access Dutch statistical data from CBS via OData v4 API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_tables(query)` | Search statistical tables | 1¢ |
| `get_table_data(identifier, limit?)` | Get table data | 1¢ |
| `list_themes()` | List statistical themes | 1¢ |

## Parameters

### search_tables
- `query` (string, required) — Search term

### get_table_data
- `identifier` (string, required) — Table identifier
- `limit` (number) — Max rows

### list_themes

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CBS OData API — it is completely free.

## Upstream API

- **Provider**: CBS OData
- **Base URL**: https://odata4.cbs.nl/CBS
- **Auth**: None required
- **Docs**: https://www.cbs.nl/en-gb/our-services/open-data

## Deploy

### Docker

```bash
docker build -t settlegrid-netherlands-cbs .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-netherlands-cbs
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
