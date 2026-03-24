# settlegrid-api-football

API-Football MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-api-football)

Comprehensive football/soccer data — fixtures, standings, and statistics.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + API_FOOTBALL_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_leagues()` | List available football leagues | 2¢ |
| `get_standings(league, season)` | Get league standings by league and season | 2¢ |
| `get_fixtures(league, season)` | Get fixtures for a league and season | 2¢ |

## Parameters

### get_standings
- `league` (number, required)
- `season` (number, required)

### get_fixtures
- `league` (number, required)
- `season` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `API_FOOTBALL_KEY` | Yes | Free key from api-sports.io (100 req/day) |


## Upstream API

- **Provider**: API-Sports
- **Base URL**: https://v3.football.api-sports.io
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://www.api-football.com/documentation-v3

## Deploy

### Docker

```bash
docker build -t settlegrid-api-football .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e API_FOOTBALL_KEY=xxx -p 3000:3000 settlegrid-api-football
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
