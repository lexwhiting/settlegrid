# settlegrid-api-football

API-Football MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-api-football)

Football/soccer leagues, fixtures, and team data from API-Sports.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + API_FOOTBALL_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_leagues(country)` | Get available football leagues | 2¢ |
| `get_fixtures(league, season)` | Get fixtures/matches for a league | 2¢ |

## Parameters

### get_leagues
- `country` (string, optional) — Filter by country name

### get_fixtures
- `league` (number, required) — League ID
- `season` (number, required) — Season year (e.g. 2024)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `API_FOOTBALL_KEY` | Yes | API-Football key from api-sports.io (free tier) |


## Upstream API

- **Provider**: API-Sports
- **Base URL**: https://v3.football.api-sports.io
- **Auth**: API key (header: x-apisports-key)
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
