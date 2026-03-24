# settlegrid-iaea-nuclear

IAEA Nuclear Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-iaea-nuclear)

Access IAEA nuclear reactor and power statistics via the PRIS API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_reactors(country?)` | List nuclear reactors by country | 1¢ |
| `get_reactor(id)` | Get details for a specific reactor | 2¢ |
| `get_power_stats(country)` | Get nuclear power statistics for a country | 2¢ |

## Parameters

### list_reactors
- `country` (string) — Country name or ISO code (e.g. France, US)

### get_reactor
- `id` (string, required) — Reactor ID or name

### get_power_stats
- `country` (string, required) — Country name or ISO code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream IAEA PRIS API API — it is completely free.

## Upstream API

- **Provider**: IAEA PRIS API
- **Base URL**: https://pris.iaea.org/PRIS/api
- **Auth**: None required
- **Docs**: https://pris.iaea.org/PRIS/

## Deploy

### Docker

```bash
docker build -t settlegrid-iaea-nuclear .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-iaea-nuclear
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
