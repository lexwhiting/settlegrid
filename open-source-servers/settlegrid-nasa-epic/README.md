# settlegrid-nasa-epic

NASA EPIC MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nasa-epic)

Earth imagery from NASA DSCOVR satellite's EPIC camera

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_natural()` | Get latest natural color Earth images | 1¢ |
| `get_by_date(date)` | Get Earth images for a specific date | 1¢ |

## Parameters

### get_natural

### get_by_date
- `date` (string, required) — Date in YYYY-MM-DD format

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NASA EPIC API.

## Upstream API

- **Provider**: NASA EPIC
- **Base URL**: https://epic.gsfc.nasa.gov/api
- **Auth**: None required
- **Docs**: https://epic.gsfc.nasa.gov/about/api

## Deploy

### Docker

```bash
docker build -t settlegrid-nasa-epic .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nasa-epic
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
