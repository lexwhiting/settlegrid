# settlegrid-timezone-api

World Timezone MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-timezone-api)

Get current time, timezone data, and UTC offsets for any timezone worldwide.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_time(timezone)` | Get current time for a timezone | 1¢ |
| `get_time_by_ip(ip)` | Get current time based on IP geolocation | 1¢ |
| `list_timezones()` | List all available IANA timezones | 1¢ |

## Parameters

### get_time
- `timezone` (string, required) — IANA timezone (e.g. "America/New_York", "Europe/London")

### get_time_by_ip
- `ip` (string, optional) — IP address (omit for your own IP)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: WorldTimeAPI
- **Base URL**: https://worldtimeapi.org/api
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: http://worldtimeapi.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-timezone-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-timezone-api
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
