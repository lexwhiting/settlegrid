# settlegrid-europeana

Europeana Cultural Heritage MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-europeana)

Search European cultural heritage records from museums, galleries, archives, and libraries across Europe.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_records(query, limit?)` | Search Europeana cultural records | 1¢ |
| `get_record(id)` | Get record by Europeana ID | 1¢ |
| `search_collections(query)` | Search Europeana collections | 1¢ |

## Parameters

### search_records
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_record
- `id` (string, required) — Europeana record ID

### search_collections
- `query` (string, required) — Collection search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EUROPEANA_API_KEY` | Yes | Europeana API API key from [https://pro.europeana.eu](https://pro.europeana.eu) |

## Upstream API

- **Provider**: Europeana API
- **Base URL**: https://api.europeana.eu/record/v2
- **Auth**: API key required
- **Docs**: https://pro.europeana.eu/page/search

## Deploy

### Docker

```bash
docker build -t settlegrid-europeana .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-europeana
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
