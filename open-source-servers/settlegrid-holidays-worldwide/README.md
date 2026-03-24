# settlegrid-holidays-worldwide

Holidays Worldwide MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-holidays-worldwide)

Get public holidays, long weekends, and available countries via the Nager.Date API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_holidays(country, year)` | Get public holidays for a country and year | 1¢ |
| `get_long_weekends(country, year)` | Get long weekends for a country and year | 1¢ |
| `next_holiday(country)` | Get the next upcoming public holiday | 1¢ |

## Parameters

### get_holidays
- `country` (string, required) — 2-letter country code
- `year` (number, required) — Year (e.g. 2026)

### get_long_weekends
- `country` (string, required) — 2-letter country code
- `year` (number, required) — Year (e.g. 2026)

### next_holiday
- `country` (string, required) — 2-letter country code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Nager.Date
- **Base URL**: https://date.nager.at/api/v3
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://date.nager.at/Api

## Deploy

### Docker

```bash
docker build -t settlegrid-holidays-worldwide .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-holidays-worldwide
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
