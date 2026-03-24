# settlegrid-golf

Golf MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-golf)

PGA Tour golf scores, leaderboards, and schedules via ESPN.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_scoreboard()` | Get current PGA tournament scores | 1¢ |
| `get_leaderboard(event_id)` | Get tournament leaderboard | 1¢ |

## Parameters

### get_leaderboard
- `event_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: ESPN
- **Base URL**: https://site.api.espn.com
- **Auth**: None required
- **Rate Limits**: ~30 req/min
- **Docs**: https://gist.github.com/akeaswaran/b48b02f1c94f873c6655e7129910fc3b

## Deploy

### Docker

```bash
docker build -t settlegrid-golf .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-golf
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
