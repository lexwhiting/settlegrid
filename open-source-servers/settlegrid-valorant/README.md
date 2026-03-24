# settlegrid-valorant

Valorant MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-valorant)

Valorant player profiles, match history, and ranked leaderboards.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_player(name, tag)` | Get player profile | 1¢ |
| `get_match_history(name, tag)` | Get match history | 1¢ |
| `get_leaderboard(region)` | Get ranked leaderboard | 1¢ |

## Parameters

### get_player / get_match_history
- `name` (string, required) — Player name
- `tag` (string, required) — Player tag
### get_leaderboard
- `region` (string, optional) — Region code (na, eu, ap, kr)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HENRIK_API_KEY` | Yes | Free from docs.henrikdev.xyz |

## Upstream API

- **Provider**: Henrik Valorant API
- **Auth**: Free API key
- **Docs**: https://docs.henrikdev.xyz/

## Deploy

### Docker
```bash
docker build -t settlegrid-valorant .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-valorant
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
