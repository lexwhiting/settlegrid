# settlegrid-world-clock

World Clock MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Get current time, timezone info, and time conversions worldwide.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_time(timezone)` | Get current time in timezone | 1¢ |
| `list_timezones()` | List all available timezones | 1¢ |
| `convert_time(from, to, time)` | Convert time between zones | 1¢ |
| `get_offset(timezone)` | Get UTC offset for timezone | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: WorldTimeAPI
- **Base URL**: https://worldtimeapi.org/api
- **Auth**: None (public)
- **Docs**: https://worldtimeapi.org/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
