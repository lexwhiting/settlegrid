# settlegrid-human-development

Human Development Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-human-development)

Access Human Development Index data via the UNDP HDR API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_hdi(country, year?)` | Get HDI for a country | 2¢ |
| `list_countries(year?)` | List countries with HDI data | 1¢ |
| `get_rankings(year?)` | Get HDI rankings | 2¢ |

## Parameters

### get_hdi
- `country` (string, required) — ISO3 country code (e.g. USA, NOR)
- `year` (string) — Year (e.g. 2022)

### list_countries
- `year` (string) — Year filter

### get_rankings
- `year` (string) — Year

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UNDP HDR API API — it is completely free.

## Upstream API

- **Provider**: UNDP HDR API
- **Base URL**: https://hdr.undp.org/data-center/api
- **Auth**: None required
- **Docs**: https://hdr.undp.org/data-center

## Deploy

### Docker

```bash
docker build -t settlegrid-human-development .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-human-development
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
