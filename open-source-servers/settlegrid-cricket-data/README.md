# settlegrid-cricket-data

Cricket Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cricket-data)

Cricket scores, matches, and player stats from TheSportsDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cricket_team(name)` | Search cricket teams | 1¢ |
| `get_cricket_events(league_id)` | Get upcoming cricket events | 1¢ |

## Parameters

### search_cricket_team
- `name` (string, required) — Cricket team name

### get_cricket_events
- `league_id` (string, required) — Cricket league ID (e.g. 4720 for IPL)

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
docker build -t settlegrid-cricket-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cricket-data
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
