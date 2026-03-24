# settlegrid-moon-phase

Moon Phase MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get current lunar phase, upcoming moon events, and moon data.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_phase(date)` | Get moon phase for a date | 1¢ |
| `get_current()` | Get current moon phase | 1¢ |
| `get_calendar(year, month)` | Get month lunar calendar | 1¢ |
| `next_full_moon()` | Get next full moon date | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Built-in calculations
- **Base URL**: N/A
- **Auth**: None
- **Docs**: Astronomical algorithms

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
