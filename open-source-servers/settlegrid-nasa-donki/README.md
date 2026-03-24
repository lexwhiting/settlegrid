# settlegrid-nasa-donki

NASA DONKI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-donki)

Space weather events including solar flares, CMEs, and geomagnetic storms

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NASA_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_cme()` | Get coronal mass ejection events | 1¢ |
| `get_solar_flare()` | Get solar flare events | 1¢ |

## Parameters

### get_cme
- `startDate` (string, optional) — Start date YYYY-MM-DD
- `endDate` (string, optional) — End date YYYY-MM-DD

### get_solar_flare
- `startDate` (string, optional) — Start date YYYY-MM-DD
- `endDate` (string, optional) — End date YYYY-MM-DD

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NASA_API_KEY` | No | NASA DONKI API key from [https://api.nasa.gov/](https://api.nasa.gov/) |

## Upstream API

- **Provider**: NASA DONKI
- **Base URL**: https://api.nasa.gov/DONKI
- **Auth**: API key (query)
- **Docs**: https://api.nasa.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-nasa-donki .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NASA_API_KEY=xxx -p 3000:3000 settlegrid-nasa-donki
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
