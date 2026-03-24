# settlegrid-swapi

SWAPI (Star Wars API) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-swapi)

Access Star Wars universe data: people, planets, starships, and films from SWAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_people(query)` | Search Star Wars characters | 1¢ |
| `search_planets(query)` | Search Star Wars planets | 1¢ |
| `get_film(episode)` | Get Star Wars film details by episode number | 1¢ |

## Parameters

### search_people
- `query` (string, required) — Character name

### search_planets
- `query` (string, required) — Planet name

### get_film
- `episode` (number, required) — Episode number (1-6)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: SWAPI
- **Base URL**: https://swapi.dev/api
- **Auth**: None required
- **Rate Limits**: 10,000/day
- **Docs**: https://swapi.dev/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-swapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-swapi
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
