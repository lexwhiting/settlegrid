# settlegrid-france-sirene

French Company Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-france-sirene)

Search French companies and establishments via the SIRENE/recherche-entreprises API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_companies(query, limit?)` | Search French companies | 1¢ |
| `get_company(siret)` | Get company by SIRET | 1¢ |
| `search_by_activity(naf_code)` | Search by NAF activity code | 1¢ |

## Parameters

### search_companies
- `query` (string, required) — Company name or keyword
- `limit` (number) — Max results (default 10)

### get_company
- `siret` (string, required) — SIRET number (14 digits)

### search_by_activity
- `naf_code` (string, required) — NAF/APE activity code

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Recherche Entreprises API — it is completely free.

## Upstream API

- **Provider**: Recherche Entreprises
- **Base URL**: https://recherche-entreprises.api.gouv.fr
- **Auth**: None required
- **Docs**: https://recherche-entreprises.api.gouv.fr/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-france-sirene .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-france-sirene
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
