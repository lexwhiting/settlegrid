# settlegrid-organic

Organic Certification Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-organic)

Search and query USDA organic integrity database for certified operations. Free, no API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_operations(name?, state?)` | Search organic certified operations | 2¢ |
| `get_operation(id)` | Get operation details by ID | 1¢ |
| `get_stats(state?)` | Get organic certification statistics | 1¢ |

## Parameters

### search_operations
- `name` (string) — Operation name to search
- `state` (string) — US state abbreviation (e.g. CA, OR, WA)

### get_operation
- `id` (string, required) — Organic operation identifier

### get_stats
- `state` (string) — US state abbreviation for state-level stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USDA Organic Integrity Database API — it is completely free.

## Upstream API

- **Provider**: USDA Organic Integrity Database
- **Base URL**: https://organic.ams.usda.gov/integrity/Api
- **Auth**: None required
- **Docs**: https://organic.ams.usda.gov/integrity/

## Deploy

### Docker

```bash
docker build -t settlegrid-organic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-organic
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
