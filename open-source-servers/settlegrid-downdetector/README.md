# settlegrid-downdetector

Service Outage Monitor MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-downdetector)

Check if websites and services are down, track recent outages, and monitor availability.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_status(domain)` | Check if a domain/service is currently up or down | 1¢ |
| `get_recent_outages(limit?)` | Get recently reported outages | 1¢ |
| `list_services()` | List popular services monitored | 1¢ |

## Parameters

### check_status
- `domain` (string, required) — Domain name to check (e.g. google.com)

### get_recent_outages
- `limit` (number) — Number of results (default 10)

### list_services

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream IsItDownRightNow API — it is completely free.

## Upstream API

- **Provider**: IsItDownRightNow
- **Base URL**: https://www.isitdownrightnow.com
- **Auth**: None required
- **Docs**: https://www.isitdownrightnow.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-downdetector .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-downdetector
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
