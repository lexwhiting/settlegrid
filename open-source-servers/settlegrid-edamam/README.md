# settlegrid-edamam

Edamam MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-edamam)

Recipe search and nutrition analysis with detailed dietary information.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + EDAMAM_APP_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_recipes(query)` | Search recipes by keyword | 2¢ |
| `search_food(query)` | Search food database for nutrition info | 2¢ |

## Parameters

### search_recipes
- `query` (string, required)

### search_food
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `EDAMAM_APP_ID` | Yes | Edamam Application ID from developer.edamam.com |


## Upstream API

- **Provider**: Edamam
- **Base URL**: https://api.edamam.com
- **Auth**: Free API key required
- **Rate Limits**: 10 req/min (free)
- **Docs**: https://developer.edamam.com/edamam-docs-recipe-api

## Deploy

### Docker

```bash
docker build -t settlegrid-edamam .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e EDAMAM_APP_ID=xxx -p 3000:3000 settlegrid-edamam
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
