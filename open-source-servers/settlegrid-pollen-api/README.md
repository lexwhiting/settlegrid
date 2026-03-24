# settlegrid-pollen-api

Ambee Pollen & Allergy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pollen-api)

Pollen counts, allergy risk, and air quality via Ambee.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + AMBEE_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_pollen_data(lat, lng)` | Get real-time pollen count and risk by coordinates | 2¢ |
| `get_air_quality(lat, lng)` | Get current air quality index by coordinates | 2¢ |

## Parameters

### get_pollen_data
- `lat` (number, required)
- `lng` (number, required)

### get_air_quality
- `lat` (number, required)
- `lng` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `AMBEE_API_KEY` | Yes | Free key from api-dashboard.getambee.com |


## Upstream API

- **Provider**: Ambee
- **Base URL**: https://api.ambeedata.com
- **Auth**: Free API key required
- **Rate Limits**: 100 calls/day (free)
- **Docs**: https://docs.ambeedata.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-pollen-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e AMBEE_API_KEY=xxx -p 3000:3000 settlegrid-pollen-api
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
