# settlegrid-countdown

Countdown MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Calculate time remaining to events and dates.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `time_until(date)` | Time remaining until a date | 1¢ |
| `time_since(date)` | Time elapsed since a date | 1¢ |
| `time_between(start, end)` | Duration between two dates | 1¢ |
| `next_holiday(country)` | Time until next public holiday | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in + Nager.Date
- **Base URL**: https://date.nager.at/api/v3
- **Auth**: None (public)
- **Docs**: https://date.nager.at/Api

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
