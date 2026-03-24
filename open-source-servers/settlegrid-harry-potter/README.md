# settlegrid-harry-potter

Harry Potter API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-harry-potter)

Access Harry Potter characters, spells, and house data.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_characters(house)` | Get all Harry Potter characters | 1¢ |
| `get_character(id)` | Get a specific character by ID | 1¢ |
| `get_spells()` | Get all Harry Potter spells | 1¢ |

## Parameters

### get_characters
- `house` (string, optional) — Filter by house: gryffindor, slytherin, hufflepuff, ravenclaw

### get_character
- `id` (string, required) — Character ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: HP API
- **Base URL**: https://hp-api.onrender.com/api
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://hp-api.onrender.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-harry-potter .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-harry-potter
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
