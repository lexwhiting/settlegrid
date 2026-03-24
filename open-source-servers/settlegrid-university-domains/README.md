# settlegrid-university-domains

University Domains MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-university-domains)

Search universities worldwide by name, country, or domain via the Hipo Labs API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_universities(name)` | Search universities by name | 1¢ |
| `search_by_country(country, name)` | Search universities in a specific country | 1¢ |

## Parameters

### search_universities
- `name` (string, required) — University name to search

### search_by_country
- `country` (string, required) — Country name (e.g. "United States", "Germany")
- `name` (string, optional) — Optional name filter

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Hipo Labs
- **Base URL**: http://universities.hipolabs.com
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://github.com/Hipo/university-domains-list

## Deploy

### Docker

```bash
docker build -t settlegrid-university-domains .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-university-domains
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
