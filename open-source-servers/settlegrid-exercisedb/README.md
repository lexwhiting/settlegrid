# settlegrid-exercisedb

ExerciseDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-exercisedb)

Exercise database with body part targeting, equipment, and GIF animations.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + RAPIDAPI_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_exercises(query)` | Search exercises by name | 2¢ |
| `list_by_bodypart(bodypart)` | List exercises targeting a body part | 2¢ |
| `list_by_equipment(equipment)` | List exercises using specific equipment | 2¢ |

## Parameters

### search_exercises
- `query` (string, required)

### list_by_bodypart
- `bodypart` (string, required)

### list_by_equipment
- `equipment` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `RAPIDAPI_KEY` | Yes | RapidAPI key from rapidapi.com |


## Upstream API

- **Provider**: ExerciseDB (RapidAPI)
- **Base URL**: https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb
- **Auth**: Free API key required
- **Rate Limits**: 100 req/day (free)
- **Docs**: https://rapidapi.com/justin-WFnsXH_t6/api/exercisedb

## Deploy

### Docker

```bash
docker build -t settlegrid-exercisedb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e RAPIDAPI_KEY=xxx -p 3000:3000 settlegrid-exercisedb
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
