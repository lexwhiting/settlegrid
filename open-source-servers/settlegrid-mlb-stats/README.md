# settlegrid-mlb-stats

MLB Stats MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mlb-stats)

Major League Baseball data — teams, rosters, and schedules.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_teams()` | List MLB teams | 1¢ |
| `get_schedule(date)` | Get game schedule for a date | 1¢ |
| `get_standings(league_id)` | Get MLB standings by league | 1¢ |

## Parameters

### get_schedule
- `date` (string, required)

### get_standings
- `league_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: MLB Stats API
- **Base URL**: https://statsapi.mlb.com/api/v1
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://statsapi.mlb.com/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-mlb-stats .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mlb-stats
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
