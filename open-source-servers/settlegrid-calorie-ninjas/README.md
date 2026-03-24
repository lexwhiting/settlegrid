# settlegrid-calorie-ninjas

Calorie Ninjas MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-calorie-ninjas)

Natural language nutrition lookup — calories, macros, and micronutrients.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CALORIE_NINJAS_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_nutrition(query)` | Get nutrition info for a food item (natural language) | 2¢ |

## Parameters

### get_nutrition
- `query` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CALORIE_NINJAS_KEY` | Yes | CalorieNinjas API key from calorieninjas.com |


## Upstream API

- **Provider**: CalorieNinjas
- **Base URL**: https://calorieninjas.com
- **Auth**: Free API key required
- **Rate Limits**: ~10,000 req/mo (free)
- **Docs**: https://calorieninjas.com/api

## Deploy

### Docker

```bash
docker build -t settlegrid-calorie-ninjas .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CALORIE_NINJAS_KEY=xxx -p 3000:3000 settlegrid-calorie-ninjas
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
