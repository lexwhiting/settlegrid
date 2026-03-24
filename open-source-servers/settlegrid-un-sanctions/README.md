# settlegrid-un-sanctions

UN Sanctions MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-un-sanctions)

Search UN sanctions lists via OpenSanctions. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_entities(query, list?, limit?)` | Search UN-sanctioned entities | 2¢ |
| `get_entity(id)` | Get entity details | 2¢ |
| `list_datasets()` | List available UN datasets | 1¢ |

## Parameters

### search_entities
- `query` (string, required) — Name or keyword
- `list` (string) — Specific UN sanctions list
- `limit` (number) — Max results (default 20)

### get_entity
- `id` (string, required) — Entity ID

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenSanctions API — it is completely free.

## Upstream API

- **Provider**: OpenSanctions
- **Base URL**: https://api.opensanctions.org
- **Auth**: None required
- **Docs**: https://api.opensanctions.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-un-sanctions .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-un-sanctions
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
