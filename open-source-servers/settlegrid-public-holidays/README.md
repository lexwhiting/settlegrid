# settlegrid-public-holidays

Public Holidays MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-public-holidays)

Public holidays, long weekends, and date checks for 100+ countries. Essential for scheduling, calendar, and productivity AI agents.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_holidays(country, year)` | All public holidays for a country/year | 1¢ |
| `is_holiday(country, date)` | Check if a specific date is a public holiday | 1¢ |
| `get_long_weekends(country, year)` | Long weekends (3+ day breaks) | 1¢ |

## Parameters

### get_holidays
- `country` (string, required) — ISO 3166-1 alpha-2 code (e.g. "US", "DE", "JP")
- `year` (number, optional) — Year (default: current year)

### is_holiday
- `country` (string, required) — ISO 3166-1 alpha-2 code
- `date` (string, required) — Date in YYYY-MM-DD format

### get_long_weekends
- `country` (string, required) — ISO 3166-1 alpha-2 code
- `year` (number, optional) — Year (default: current year)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Nager.Date API.

## Upstream API

- **Provider**: Nager.Date
- **Base URL**: https://date.nager.at/api/v3
- **Auth**: None required
- **Coverage**: 100+ countries
- **Docs**: https://date.nager.at/swagger/

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
