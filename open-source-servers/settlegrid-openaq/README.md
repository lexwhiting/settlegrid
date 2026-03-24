# settlegrid-openaq

OpenAQ MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openaq)

Global air quality measurements from thousands of monitoring stations.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_latest(city, country)` | Get latest air quality measurements by city or country | 1¢ |
| `get_locations(city, country)` | Search air quality monitoring locations | 1¢ |
| `get_measurements(location_id)` | Get air quality measurements for a location | 1¢ |

## Parameters

### get_latest
- `city` (string, optional)
- `country` (string, optional)

### get_locations
- `city` (string, optional)
- `country` (string, optional)

### get_measurements
- `location_id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenAQ
- **Base URL**: https://api.openaq.org
- **Auth**: None required
- **Rate Limits**: ~120 req/min
- **Docs**: https://docs.openaq.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-openaq .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openaq
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
