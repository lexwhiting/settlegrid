# settlegrid-themealdb

TheMealDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-themealdb)

Free meal and recipe database with categories, ingredients, and instructions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_meals(query)` | Search meals by name | 1¢ |
| `get_meal(meal_id)` | Get meal details by ID | 1¢ |
| `random_meal()` | Get a random meal recipe | 1¢ |

## Parameters

### search_meals
- `query` (string, required)

### get_meal
- `meal_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: TheMealDB
- **Base URL**: https://www.themealdb.com/api.php
- **Auth**: None required
- **Rate Limits**: ~100 req/day (free)
- **Docs**: https://www.themealdb.com/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-themealdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-themealdb
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
