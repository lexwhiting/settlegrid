# settlegrid-spoonacular-nutrition

Spoonacular Nutrition MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-spoonacular-nutrition)

Recipe search and nutrition analysis from Spoonacular API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_recipes_spoon(query, diet?, limit?)` | Search recipes | 2¢ |
| `get_nutrition_info(ingredient)` | Get nutrition for ingredient | 2¢ |

## Parameters

### search_recipes_spoon
- `query` (string, required) — Recipe search term
- `diet` (string) — Diet filter (vegan, vegetarian, keto, etc.)
- `limit` (number) — Max results

### get_nutrition_info
- `ingredient` (string, required) — Ingredient name and amount (e.g. "100g chicken breast")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SPOONACULAR_API_KEY` | Yes | Spoonacular API key from [https://spoonacular.com/food-api/console#Dashboard](https://spoonacular.com/food-api/console#Dashboard) |

## Upstream API

- **Provider**: Spoonacular
- **Base URL**: https://api.spoonacular.com
- **Auth**: API key required
- **Docs**: https://spoonacular.com/food-api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-spoonacular-nutrition .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-spoonacular-nutrition
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
