# settlegrid-wakatime

WakaTime MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wakatime)

Developer coding activity metrics and language statistics

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WAKATIME_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_stats()` | Get coding activity stats | 1¢ |
| `get_leaders()` | Get public leaderboard | 1¢ |

## Parameters

### get_stats

### get_leaders
- `page` (number, optional) — Page number (default: 1)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WAKATIME_API_KEY` | Yes | WakaTime API key from [https://wakatime.com/api-key](https://wakatime.com/api-key) |

## Upstream API

- **Provider**: WakaTime
- **Base URL**: https://wakatime.com/api/v1
- **Auth**: API key (header)
- **Docs**: https://wakatime.com/developers

## Deploy

### Docker

```bash
docker build -t settlegrid-wakatime .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WAKATIME_API_KEY=xxx -p 3000:3000 settlegrid-wakatime
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
