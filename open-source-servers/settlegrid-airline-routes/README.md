# settlegrid-airline-routes

Airline Routes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-airline-routes)

Global airline route data from OpenFlights.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_airports(country)` | Get airport data (CSV parsed) by country | 1¢ |
| `get_airlines(country)` | Get airline data (CSV parsed) by country | 1¢ |

## Parameters

### get_airports
- `country` (string, required)

### get_airlines
- `country` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenFlights
- **Base URL**: https://openflights.org
- **Auth**: None required
- **Rate Limits**: Unlimited (static data)
- **Docs**: https://openflights.org/data.html

## Deploy

### Docker

```bash
docker build -t settlegrid-airline-routes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-airline-routes
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
