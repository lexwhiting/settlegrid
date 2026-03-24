# settlegrid-esports

Esports MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-esports)

Esports match data, teams, and tournaments via PandaScore.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PANDASCORE_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_matches(game)` | List upcoming or recent esports matches | 2¢ |
| `search_teams(query)` | Search esports teams by name | 2¢ |
| `list_tournaments(game)` | List current esports tournaments | 2¢ |

## Parameters

### list_matches
- `game` (string, optional)

### search_teams
- `query` (string, required)

### list_tournaments
- `game` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PANDASCORE_TOKEN` | Yes | PandaScore API token from pandascore.co |


## Upstream API

- **Provider**: PandaScore
- **Base URL**: https://api.pandascore.co
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/hr (free)
- **Docs**: https://developers.pandascore.co/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-esports .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PANDASCORE_TOKEN=xxx -p 3000:3000 settlegrid-esports
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
