# settlegrid-ror

Research Organization Registry MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ror)

Search and retrieve metadata about research organizations worldwide via the ROR API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_organizations(query, limit?)` | Search research organizations | 1¢ |
| `get_organization(id)` | Get organization details | 1¢ |
| `list_by_country(country)` | List organizations by country | 1¢ |

## Parameters

### search_organizations
- `query` (string, required) — Organization name or keyword
- `limit` (number) — Max results (default: 10, max: 40)

### get_organization
- `id` (string, required) — ROR ID (e.g. https://ror.org/03yrm5c26 or 03yrm5c26)

### list_by_country
- `country` (string, required) — ISO 3166-1 alpha-2 country code (e.g. US, GB, DE)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ROR API — it is completely free.

## Upstream API

- **Provider**: ROR
- **Base URL**: https://api.ror.org/v2/organizations
- **Auth**: None required
- **Docs**: https://ror.readme.io/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-ror .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ror
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
