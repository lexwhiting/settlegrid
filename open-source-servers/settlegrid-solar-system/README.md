# settlegrid-solar-system

Solar System Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-solar-system)

Access solar system body data via Le Systeme Solaire API. List celestial bodies, get details, and filter planets.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_bodies(filter?)` | List celestial bodies with optional filter | 1¢ |
| `get_body(id)` | Get celestial body details by ID | 1¢ |
| `get_planets()` | Get all planets in the solar system | 1¢ |

## Parameters

### list_bodies
- `filter` (string) — Body type filter (e.g. "planet", "dwarf planet", "moon")

### get_body
- `id` (string, required) — Body ID/name (e.g. "terre", "mars", "jupiter")

### get_planets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Le Systeme Solaire API API — it is completely free.

## Upstream API

- **Provider**: Le Systeme Solaire API
- **Base URL**: https://api.le-systeme-solaire.net/rest
- **Auth**: None required
- **Docs**: https://api.le-systeme-solaire.net/

## Deploy

### Docker

```bash
docker build -t settlegrid-solar-system .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-solar-system
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
