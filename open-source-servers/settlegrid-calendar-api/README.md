# settlegrid-calendar-api

Calendar & Date API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-calendar-api)

Get calendar data, date calculations, and day-of-year information.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_current_date(timezone)` | Get detailed current date info for a timezone | 1¢ |
| `get_holidays(country, year)` | Get public holidays for a country and year | 1¢ |

## Parameters

### get_current_date
- `timezone` (string, required) — IANA timezone (e.g. "America/New_York")

### get_holidays
- `country` (string, required) — ISO 3166-1 alpha-2 country code
- `year` (number, required) — Year (e.g. 2026)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: WorldTimeAPI + date.nager.at
- **Base URL**: https://worldtimeapi.org/api
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: http://worldtimeapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-calendar-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-calendar-api
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
