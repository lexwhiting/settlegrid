# settlegrid-wildlife

IUCN Red List MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wildlife)

Endangered species data from the IUCN Red List of Threatened Species.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + IUCN_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_species(name)` | Search species by name | 2¢ |
| `get_country_species(iso)` | Get species list for a country by ISO code | 2¢ |

## Parameters

### search_species
- `name` (string, required)

### get_country_species
- `iso` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IUCN_TOKEN` | Yes | Free token from apiv3.iucnredlist.org/api/v3/token |


## Upstream API

- **Provider**: IUCN
- **Base URL**: https://apiv3.iucnredlist.org/api/v3
- **Auth**: Free API key required
- **Rate Limits**: Reasonable use
- **Docs**: https://apiv3.iucnredlist.org/api/v3/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-wildlife .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e IUCN_TOKEN=xxx -p 3000:3000 settlegrid-wildlife
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
