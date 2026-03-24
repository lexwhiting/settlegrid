# settlegrid-open-notify

Open Notify (ISS) MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-notify)

International Space Station current location and astronauts in space

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_iss_position()` | Get current ISS position | 1¢ |
| `get_astronauts()` | Get astronauts currently in space | 1¢ |

## Parameters

### get_iss_position

### get_astronauts

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open Notify (ISS) API.

## Upstream API

- **Provider**: Open Notify (ISS)
- **Base URL**: http://api.open-notify.org
- **Auth**: None required
- **Docs**: http://open-notify.org/Open-Notify-API/

## Deploy

### Docker

```bash
docker build -t settlegrid-open-notify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-notify
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
