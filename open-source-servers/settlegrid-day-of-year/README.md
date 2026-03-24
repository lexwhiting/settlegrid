# settlegrid-day-of-year

Day of Year MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get day of year, week number, and detailed date information.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_day_info(date)` | Get detailed day info | 1¢ |
| `get_today()` | Get today's date info | 1¢ |
| `get_week_number(date)` | Get ISO week number | 1¢ |
| `days_remaining()` | Days remaining in year | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Date calculations

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
