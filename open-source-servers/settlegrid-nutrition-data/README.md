# settlegrid-nutrition-data

USDA FoodData Central MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nutrition-data)

Search foods and get detailed nutritional information from the USDA FoodData Central database. 300,000+ foods with complete nutrient profiles.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid + USDA API keys
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_food(query)` | Search foods by name/keyword | 1¢ |
| `get_nutrients(fdcId)` | Key nutrient breakdown for a food | 2¢ |
| `get_food_details(fdcId)` | Full details + nutrients + portions | 2¢ |

## Parameters

### search_food
- `query` (string, required) — Food name (e.g. "chicken breast", "banana")
- `limit` (number, optional) — Max results (default 20, max 50)
- `dataType` (string, optional) — "Foundation", "SR Legacy", "Branded", or "Survey"

### get_nutrients
- `fdcId` (number, required) — FDC ID from search results

### get_food_details
- `fdcId` (number, required) — FDC ID from search results

## Tracked Nutrients

Energy, Protein, Total Fat, Carbohydrates, Fiber, Sugars, Calcium, Iron, Sodium, Vitamin C, Vitamin A, Cholesterol, Saturated Fat, Potassium.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `USDA_API_KEY` | Yes | Free USDA API key from [fdc.nal.usda.gov](https://fdc.nal.usda.gov/api-key-signup.html) |

## Upstream API

- **Provider**: USDA FoodData Central
- **Base URL**: https://api.nal.usda.gov/fdc/v1
- **Auth**: Free API key required
- **Rate Limits**: 1000 requests/hour
- **Docs**: https://fdc.nal.usda.gov/api-guide.html

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
