# settlegrid-spacex

SpaceX MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-spacex)

SpaceX launches, rockets, capsules, and mission data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_launches()` | Get latest SpaceX launches | 1¢ |
| `get_upcoming()` | Get upcoming SpaceX launches | 1¢ |
| `get_rockets()` | Get all SpaceX rockets | 1¢ |

## Parameters

### get_launches

### get_upcoming

### get_rockets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SpaceX API.

## Upstream API

- **Provider**: SpaceX
- **Base URL**: https://api.spacexdata.com/v4
- **Auth**: None required
- **Docs**: https://github.com/r-spacex/SpaceX-API

## Deploy

### Docker

```bash
docker build -t settlegrid-spacex .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-spacex
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
