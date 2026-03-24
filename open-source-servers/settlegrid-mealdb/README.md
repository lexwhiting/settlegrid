# settlegrid-mealdb

TheMealDB MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mealdb)

Meal recipes, ingredients, and cooking instructions database

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(s)` | Search meals by name | 1¢ |
| `get_random()` | Get a random meal recipe | 1¢ |
| `get_categories()` | Get all meal categories | 1¢ |

## Parameters

### search
- `s` (string, required) — Meal name to search

### get_random

### get_categories

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TheMealDB API.

## Upstream API

- **Provider**: TheMealDB
- **Base URL**: https://www.themealdb.com/api/json/v1/1
- **Auth**: None required
- **Docs**: https://www.themealdb.com/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-mealdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mealdb
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
