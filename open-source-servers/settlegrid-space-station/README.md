# settlegrid-space-station

Space Station MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Track the ISS location and get astronaut data in real-time.

## Quick Start

```bash
npm install && cp .env.example .env && npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_location()` | Get current ISS location | 1¢ |
| `get_astronauts()` | List people in space | 1¢ |
| `get_passes(lat, lon)` | Get ISS pass predictions | 1¢ |
| `get_tle()` | Get ISS TLE orbital data | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Upstream API

- **Provider**: Open Notify + N2YO
- **Base URL**: http://api.open-notify.org
- **Auth**: None (public)
- **Docs**: http://open-notify.org/Open-Notify-API/

## License
MIT - see [LICENSE](LICENSE)

---
Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
