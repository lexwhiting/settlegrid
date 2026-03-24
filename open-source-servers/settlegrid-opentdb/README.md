# settlegrid-opentdb

Open Trivia Database MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-opentdb)

Get trivia questions across categories from the Open Trivia Database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_questions(amount, category, difficulty)` | Get trivia questions | 1¢ |
| `get_categories()` | List all trivia categories | 1¢ |

## Parameters

### get_questions
- `amount` (number, optional) — Number of questions (1-50, default 10)
- `category` (number, optional) — Category ID (9-32)
- `difficulty` (string, optional) — "easy", "medium", or "hard"

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Open Trivia DB
- **Base URL**: https://opentdb.com
- **Auth**: None required
- **Rate Limits**: 1 req/5s
- **Docs**: https://opentdb.com/api_config.php

## Deploy

### Docker

```bash
docker build -t settlegrid-opentdb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-opentdb
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
