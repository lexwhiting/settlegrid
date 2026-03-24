# settlegrid-cocktail-recipes

Cocktail Recipes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-cocktail-recipes)

Cocktail recipes, ingredients, and drink lookup from TheCocktailDB.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cocktail(name)` | Search cocktails by name | 1¢ |
| `get_random_cocktail()` | Get a random cocktail recipe | 1¢ |
| `list_by_ingredient(ingredient)` | List cocktails by ingredient | 1¢ |

## Parameters

### search_cocktail
- `name` (string, required) — Cocktail name

### get_random_cocktail

### list_by_ingredient
- `ingredient` (string, required) — Ingredient name (e.g. Vodka)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TheCocktailDB API — it is completely free.

## Upstream API

- **Provider**: TheCocktailDB
- **Base URL**: https://www.thecocktaildb.com/api/json/v1/1
- **Auth**: None required
- **Docs**: https://www.thecocktaildb.com/api.php

## Deploy

### Docker

```bash
docker build -t settlegrid-cocktail-recipes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-cocktail-recipes
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
