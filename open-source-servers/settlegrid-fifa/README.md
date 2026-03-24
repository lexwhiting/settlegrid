# settlegrid-fifa

FIFA MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fifa)

FIFA world football rankings and competition data via Football-Data.org.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_competitions()` | List available football competitions | 1¢ |
| `get_competition(competition_id)` | Get competition details and standings | 1¢ |
| `get_team(team_id)` | Get team details and squad | 1¢ |

## Parameters

### get_competition
- `competition_id` (number, required)

### get_team
- `team_id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Football-Data.org
- **Base URL**: https://api.football-data.org/v4
- **Auth**: None required
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://www.football-data.org/documentation/quickstart

## Deploy

### Docker

```bash
docker build -t settlegrid-fifa .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fifa
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
