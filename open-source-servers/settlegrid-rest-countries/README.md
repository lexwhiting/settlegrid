# settlegrid-rest-countries

REST Countries MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-rest-countries)

Detailed country data including population, languages, currencies, and flags

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_all()` | Get data for all countries | 1¢ |
| `get_by_name(name)` | Get country by name | 1¢ |

## Parameters

### get_all
- `fields` (string, optional) — Comma-separated fields to return

### get_by_name
- `name` (string, required) — Country name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream REST Countries API.

## Upstream API

- **Provider**: REST Countries
- **Base URL**: https://restcountries.com/v3.1
- **Auth**: None required
- **Docs**: https://restcountries.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-rest-countries .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-rest-countries
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
