# settlegrid-roblox

Roblox MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-roblox)

Roblox game details, user profiles, and search.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_game_details(universe_id)` | Get game details | 1¢ |
| `get_user_info(user_id)` | Get user info | 1¢ |
| `search_users(keyword)` | Search users | 1¢ |

## Parameters

### get_game_details
- `universe_id` (string, required) — Roblox universe ID
### get_user_info
- `user_id` (string, required) — Roblox user ID
### search_users
- `keyword` (string, required) — Username search
- `limit` (number, optional) — Max results (default 10, max 25)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Roblox Public APIs
- **Auth**: None required

## Deploy

### Docker
```bash
docker build -t settlegrid-roblox .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-roblox
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
