# settlegrid-cycling-data

Cycling Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cycling-data)

Cycling race and team data from TheSportsDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cycling_team(name)` | Search cycling teams | 1¢ |
| `get_cycling_events(league_id)` | Get upcoming cycling events | 1¢ |

## Parameters

### search_cycling_team
- `name` (string, required) — Team name

### get_cycling_events
- `league_id` (string, required) — Cycling league ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TheSportsDB API — it is completely free.

## Upstream API

- **Provider**: TheSportsDB
- **Base URL**: https://www.thesportsdb.com/api/v1/json/3
- **Auth**: None required
- **Docs**: https://www.thesportsdb.com/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-cycling-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cycling-data
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
