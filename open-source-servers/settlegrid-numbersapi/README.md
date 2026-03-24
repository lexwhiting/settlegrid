# settlegrid-numbersapi

Numbers API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-numbersapi)

Interesting facts about numbers, dates, and mathematical concepts

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_number_fact(number)` | Get a fact about a number | 1¢ |
| `get_date_fact(month, day)` | Get a fact about a date | 1¢ |

## Parameters

### get_number_fact
- `number` (number, required) — Any integer

### get_date_fact
- `month` (number, required) — Month number (1-12)
- `day` (number, required) — Day number (1-31)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Numbers API API.

## Upstream API

- **Provider**: Numbers API
- **Base URL**: http://numbersapi.com
- **Auth**: None required
- **Docs**: http://numbersapi.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-numbersapi .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-numbersapi
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
