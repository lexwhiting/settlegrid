# settlegrid-nhl-stats

NHL Stats MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nhl-stats)

NHL hockey teams, standings, and schedule from the NHL Web API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_standings(date)` | Get current NHL standings | 1¢ |
| `get_schedule(date)` | Get games for a date | 1¢ |
| `get_roster(team)` | Get team roster | 1¢ |

## Parameters

### get_standings
- `date` (string, optional) — Date for standings (YYYY-MM-DD)

### get_schedule
- `date` (string, required) — Date in YYYY-MM-DD format

### get_roster
- `team` (string, required) — Team abbreviation (e.g. "TOR", "BOS")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: NHL
- **Base URL**: https://api-web.nhle.com/v1
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://api-web.nhle.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-nhl-stats .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nhl-stats
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
