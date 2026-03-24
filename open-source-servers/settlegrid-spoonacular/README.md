# settlegrid-spoonacular

Spoonacular MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-spoonacular)

Comprehensive recipe and food API with meal planning and nutrition.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + SPOONACULAR_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_recipes(query)` | Search recipes by query | 2¢ |
| `get_recipe(recipe_id)` | Get recipe details including instructions | 2¢ |
| `search_ingredients(query)` | Search food ingredients | 2¢ |

## Parameters

### search_recipes
- `query` (string, required)

### get_recipe
- `recipe_id` (number, required)

### search_ingredients
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SPOONACULAR_API_KEY` | Yes | Spoonacular API key from spoonacular.com/food-api |


## Upstream API

- **Provider**: Spoonacular
- **Base URL**: https://api.spoonacular.com
- **Auth**: Free API key required
- **Rate Limits**: 150 req/day (free)
- **Docs**: https://spoonacular.com/food-api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-spoonacular .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e SPOONACULAR_API_KEY=xxx -p 3000:3000 settlegrid-spoonacular
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
