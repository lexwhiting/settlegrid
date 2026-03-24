# settlegrid-timezone-data

TimeZone Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-timezone-data)

World timezone information and time conversion via WorldTimeAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_timezone(timezone)` | Get current time in timezone | 1¢ |
| `list_timezones()` | List all available timezones | 1¢ |
| `get_time_by_ip(ip)` | Get timezone by IP address | 1¢ |

## Parameters

### get_timezone
- `timezone` (string, required) — Timezone (e.g. America/New_York, Europe/London)

### list_timezones

### get_time_by_ip
- `ip` (string, required) — IP address

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream WorldTimeAPI API — it is completely free.

## Upstream API

- **Provider**: WorldTimeAPI
- **Base URL**: https://worldtimeapi.org/api
- **Auth**: None required
- **Docs**: http://worldtimeapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-timezone-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-timezone-data
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
