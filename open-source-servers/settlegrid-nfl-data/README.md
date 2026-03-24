# settlegrid-nfl-data

NFL Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nfl-data)

NFL teams, scores, and standings from the ESPN public API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_scoreboard(week)` | Get current/recent NFL scores | 1¢ |
| `get_standings()` | Get NFL standings | 1¢ |
| `get_teams()` | List all NFL teams | 1¢ |

## Parameters

### get_scoreboard
- `week` (number, optional) — NFL week number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: ESPN
- **Base URL**: https://site.api.espn.com/apis/site/v2/sports/football/nfl
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b

## Deploy

### Docker

```bash
docker build -t settlegrid-nfl-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nfl-data
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
