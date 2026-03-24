# settlegrid-superhero

Superhero API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-superhero)

Look up superhero stats, powers, and biographies from the Superhero API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_heroes(query)` | Search superheroes by name | 1¢ |
| `get_hero(id)` | Get hero details by ID | 1¢ |

## Parameters

### search_heroes
- `query` (string, required) — Hero name

### get_hero
- `id` (number, required) — Superhero ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Akabab Superhero API
- **Base URL**: https://akabab.github.io/superhero-api/api
- **Auth**: None required
- **Rate Limits**: Unlimited (static CDN)
- **Docs**: https://akabab.github.io/superhero-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-superhero .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-superhero
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
