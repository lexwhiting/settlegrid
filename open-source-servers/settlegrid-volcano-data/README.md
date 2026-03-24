# settlegrid-volcano-data

Volcanic Activity Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-volcano-data)

Access volcanic activity data via USGS Volcano Hazards API and Smithsonian GVP. List volcanoes, get details, and check recent eruptions.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_volcanoes(country?, status?)` | List volcanoes with optional filters | 1¢ |
| `get_volcano(id)` | Get volcano details by ID | 1¢ |
| `get_recent_eruptions(limit?)` | Get recent volcanic eruptions | 2¢ |

## Parameters

### list_volcanoes
- `country` (string) — Country name (e.g. "United States", "Japan")
- `status` (string) — Status filter (e.g. "Historical", "Holocene")

### get_volcano
- `id` (string, required) — Volcano number or name

### get_recent_eruptions
- `limit` (number) — Max results (default 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream USGS Volcano Hazards API API — it is completely free.

## Upstream API

- **Provider**: USGS Volcano Hazards API
- **Base URL**: https://volcanoes.usgs.gov/vsc/api
- **Auth**: None required
- **Docs**: https://volcanoes.usgs.gov/

## Deploy

### Docker

```bash
docker build -t settlegrid-volcano-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-volcano-data
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
