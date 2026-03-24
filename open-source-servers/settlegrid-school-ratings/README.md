# settlegrid-school-ratings

SchoolDigger MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-school-ratings)

School quality ratings and rankings from SchoolDigger.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + SCHOOLDIGGER_APP_ID
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_schools(st, city)` | Search schools by location | 2¢ |
| `get_school(id)` | Get details for a school by ID | 2¢ |

## Parameters

### search_schools
- `st` (string, required)
- `city` (string, optional)

### get_school
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SCHOOLDIGGER_APP_ID` | Yes | App ID from developer.schooldigger.com |


## Upstream API

- **Provider**: SchoolDigger
- **Base URL**: https://api.schooldigger.com/v2.0
- **Auth**: Free API key required
- **Rate Limits**: 50 req/day (free)
- **Docs**: https://developer.schooldigger.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-school-ratings .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e SCHOOLDIGGER_APP_ID=xxx -p 3000:3000 settlegrid-school-ratings
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
