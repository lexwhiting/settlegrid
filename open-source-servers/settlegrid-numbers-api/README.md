# settlegrid-numbers-api

Numbers API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-numbers-api)

Get interesting facts about numbers, dates, and math trivia via the Numbers API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `number_fact(number)` | Get a trivia fact about a number | 1¢ |
| `date_fact(month, day)` | Get a fact about a date in history | 1¢ |
| `math_fact(number)` | Get a mathematical property of a number | 1¢ |

## Parameters

### number_fact
- `number` (number, required) — The number to get a fact about

### date_fact
- `month` (number, required) — Month (1-12)
- `day` (number, required) — Day of month (1-31)

### math_fact
- `number` (number, required) — The number to get a math fact about

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Numbers API
- **Base URL**: http://numbersapi.com
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: http://numbersapi.com

## Deploy

### Docker

```bash
docker build -t settlegrid-numbers-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-numbers-api
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
