# settlegrid-country-flags

Country Flags MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-country-flags)

Get country flag images, country info, and flag URLs via the REST Countries API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_flag(code)` | Get flag image URL and country info by country code | 1¢ |
| `search_flags(name)` | Search countries and their flags by name | 1¢ |

## Parameters

### get_flag
- `code` (string, required) — ISO 3166-1 alpha-2 country code (e.g. "US", "GB", "JP")

### search_flags
- `name` (string, required) — Country name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: REST Countries / FlagCDN
- **Base URL**: https://restcountries.com/v3.1
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://restcountries.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-country-flags .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-country-flags
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
