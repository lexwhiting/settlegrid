# settlegrid-iss-tracker

ISS Tracker MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-iss-tracker)

Track the International Space Station position, crew, and overhead passes. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_position()` | Get current ISS position | 1¢ |
| `get_crew()` | Get current ISS crew | 1¢ |
| `get_passes(lat, lon, count?)` | Get upcoming overhead passes | 1¢ |

## Parameters

### get_position

### get_crew

### get_passes
- `lat` (number, required) — Observer latitude
- `lon` (number, required) — Observer longitude
- `count` (number) — Number of passes to return (default: 5)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open Notify API — it is completely free.

## Upstream API

- **Provider**: Open Notify
- **Base URL**: http://api.open-notify.org
- **Auth**: None required
- **Docs**: http://open-notify.org/Open-Notify-API/

## Deploy

### Docker

```bash
docker build -t settlegrid-iss-tracker .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-iss-tracker
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
