# settlegrid-swapi

SWAPI Star Wars MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-swapi)

Star Wars universe data — characters, planets, starships from SWAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_people(name)` | Search Star Wars characters | 1¢ |
| `search_planets(name)` | Search Star Wars planets | 1¢ |
| `search_starships(name)` | Search Star Wars starships | 1¢ |

## Parameters

### search_people
- `name` (string, required) — Character name

### search_planets
- `name` (string, required) — Planet name

### search_starships
- `name` (string, required) — Starship name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SWAPI API — it is completely free.

## Upstream API

- **Provider**: SWAPI
- **Base URL**: https://swapi.dev/api
- **Auth**: None required
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
