# settlegrid-worldtime

World Time API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-worldtime)

Current time and timezone data for locations worldwide

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_by_timezone(area, location)` | Get current time for a timezone | 1¢ |
| `get_by_ip(ip)` | Get current time based on IP address | 1¢ |
| `list_timezones()` | List all available timezones | 1¢ |

## Parameters

### get_by_timezone
- `area` (string, required) — Timezone area (e.g. America)
- `location` (string, required) — Timezone location (e.g. New_York)

### get_by_ip
- `ip` (string, required) — IP address

### list_timezones

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream World Time API API.

## Upstream API

- **Provider**: World Time API
- **Base URL**: http://worldtimeapi.org/api
- **Auth**: None required
- **Docs**: http://worldtimeapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-worldtime .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-worldtime
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
