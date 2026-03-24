# settlegrid-leap-year

Leap Year MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Check leap years and get calendar information.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check(year)` | Check if year is a leap year | 1¢ |
| `next_leap(from_year)` | Find next leap year | 1¢ |
| `list_range(start, end)` | List leap years in range | 1¢ |
| `year_info(year)` | Get detailed year info | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Calendar calculations

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
