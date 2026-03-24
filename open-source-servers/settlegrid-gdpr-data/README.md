# settlegrid-gdpr-data

GDPR Compliance Info MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gdpr-data)

Search GDPR enforcement actions, fines, and compliance data. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_fines(query?, country?, limit?)` | Search GDPR fines | 2¢ |
| `get_fine(id)` | Get fine details by ID | 2¢ |
| `get_stats(country?)` | Get GDPR enforcement statistics | 1¢ |

## Parameters

### search_fines
- `query` (string) — Search query for fines
- `country` (string) — Country code (e.g. DE, FR, IT)
- `limit` (number) — Max results (default 20)

### get_fine
- `id` (string, required) — Fine record ID

### get_stats
- `country` (string) — Country code for stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GDPR Enforcement Tracker API — it is completely free.

## Upstream API

- **Provider**: GDPR Enforcement Tracker
- **Base URL**: https://www.enforcementtracker.com
- **Auth**: None required
- **Docs**: https://www.enforcementtracker.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-gdpr-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gdpr-data
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
