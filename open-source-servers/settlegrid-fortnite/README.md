# settlegrid-fortnite

Fortnite MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fortnite)

Fortnite player stats, item shop, and news.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_player_stats(name)` | Get player stats | 1¢ |
| `get_shop()` | Get current item shop | 1¢ |
| `get_news()` | Get game news | 1¢ |

## Parameters

### get_player_stats
- `name` (string, required) — Player name
- `platform` (string, optional) — Platform (epic, psn, xbl)
### get_shop / get_news
No parameters required.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FORTNITE_API_KEY` | Yes | Free from fortnite-api.com |

## Upstream API

- **Provider**: Fortnite-API
- **Auth**: Free API key
- **Docs**: https://fortnite-api.com/

## Deploy

### Docker
```bash
docker build -t settlegrid-fortnite .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fortnite
```

### Vercel
```bash
npm run build
vercel --prod
```

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
