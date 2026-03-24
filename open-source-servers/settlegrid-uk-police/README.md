# settlegrid-uk-police

UK Crime Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-police)

Access UK street-level crime data, police forces and neighbourhood info.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_crimes(lat, lon, date?)` | Get street-level crimes | 1¢ |
| `get_forces()` | List all police forces | 1¢ |
| `get_neighbourhood(force, id)` | Get neighbourhood details | 1¢ |

## Parameters

### get_crimes
- `lat` (number, required) — Latitude
- `lon` (number, required) — Longitude
- `date` (string) — Month (YYYY-MM)

### get_forces

### get_neighbourhood
- `force` (string, required) — Force slug
- `id` (string, required) — Neighbourhood ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UK Police Data API API — it is completely free.

## Upstream API

- **Provider**: UK Police Data API
- **Base URL**: https://data.police.uk/api
- **Auth**: None required
- **Docs**: https://data.police.uk/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-police .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uk-police
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
