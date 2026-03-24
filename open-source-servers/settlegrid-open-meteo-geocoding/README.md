# settlegrid-open-meteo-geocoding

Open-Meteo Geocoding MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-meteo-geocoding)

Free geocoding API to resolve city names to coordinates

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(name)` | Search for locations by name | 1¢ |

## Parameters

### search
- `name` (string, required) — City or location name
- `count` (number, optional) — Number of results (1-100) (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open-Meteo Geocoding API.

## Upstream API

- **Provider**: Open-Meteo Geocoding
- **Base URL**: https://geocoding-api.open-meteo.com/v1
- **Auth**: None required
- **Docs**: https://open-meteo.com/en/docs/geocoding-api

## Deploy

### Docker

```bash
docker build -t settlegrid-open-meteo-geocoding .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-meteo-geocoding
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
