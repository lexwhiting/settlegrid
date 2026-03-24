# settlegrid-twitch-data

Twitch Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-twitch-data)

Twitch stream, channel, and game data for live content.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_top_streams(limit)` | Get top live streams | 1¢ |
| `search_channels(query)` | Search channels | 1¢ |
| `get_stream_by_user(username)` | Get stream by username | 1¢ |

## Parameters

### get_top_streams
- `limit` (number, optional) — Results (default 20, max 100)
- `game_id` (string, optional) — Filter by game
### search_channels
- `query` (string, required) — Search term
### get_stream_by_user
- `username` (string, required) — Twitch username

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `TWITCH_CLIENT_ID` | Yes | Free from dev.twitch.tv |
| `TWITCH_CLIENT_SECRET` | Yes | Free from dev.twitch.tv |

## Upstream API

- **Provider**: Twitch Helix API
- **Auth**: Free OAuth2 client credentials
- **Docs**: https://dev.twitch.tv/docs/api/

## Deploy

### Docker
```bash
docker build -t settlegrid-twitch-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-twitch-data
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
