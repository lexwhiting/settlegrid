# settlegrid-hotel-prices

Hotel Pricing MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hotel-prices)

Hotel pricing comparison data for travel planning.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_hotels(city)` | Search hotel prices by city | 2¢ |
| `get_hotel_details(hotel_id)` | Get hotel details | 1¢ |

## Parameters

### search_hotels
- `city` (string, required) — City name
- `checkin` (string, optional) — Check-in date (YYYY-MM-DD)
- `checkout` (string, optional) — Check-out date (YYYY-MM-DD)

### get_hotel_details
- `hotel_id` (string, required) — Hotel identifier

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Makcorps Hotel API
- **Base URL**: https://api.makcorps.com
- **Auth**: Free tier available
- **Docs**: https://www.makcorps.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-hotel-prices .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hotel-prices
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
