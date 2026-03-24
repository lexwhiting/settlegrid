# settlegrid-travel-advisory

Travel Advisory MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-travel-advisory)

Government travel advisories and safety ratings for every country.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_all_advisories()` | Get all travel advisories | 1¢ |
| `get_advisory_by_country(country_code)` | Get advisory for a country | 1¢ |

## Parameters

### get_all_advisories
No parameters required.

### get_advisory_by_country
- `country_code` (string, required) — ISO 3166-1 alpha-2 code (e.g. US, GB, DE)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Travel Advisory API
- **Base URL**: https://www.travel-advisory.info/api
- **Auth**: None required
- **Docs**: https://www.travel-advisory.info/

## Deploy

### Docker

```bash
docker build -t settlegrid-travel-advisory .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-travel-advisory
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
