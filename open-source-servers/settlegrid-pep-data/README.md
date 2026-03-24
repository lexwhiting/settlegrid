# settlegrid-pep-data

PEP Databases MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pep-data)

Search Politically Exposed Persons (PEP) data via OpenSanctions. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_peps(query, country?, limit?)` | Search PEP database | 2¢ |
| `get_entity(id)` | Get PEP entity details | 2¢ |
| `get_stats(dataset?)` | Get PEP dataset statistics | 1¢ |

## Parameters

### search_peps
- `query` (string, required) — Name or keyword
- `country` (string) — Country code (ISO 2-letter)
- `limit` (number) — Max results (default 20)

### get_entity
- `id` (string, required) — Entity ID

### get_stats
- `dataset` (string) — Dataset name (default: peps)

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
docker build -t settlegrid-pep-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pep-data
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
