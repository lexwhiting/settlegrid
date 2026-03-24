# settlegrid-datacite

DataCite DOI Metadata MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-datacite)

Retrieve and search DOI metadata for research datasets, publications, and other scholarly outputs via DataCite.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_doi(doi)` | Get metadata for a DOI | 1¢ |
| `search_dois(query, limit?)` | Search DOIs by query | 1¢ |
| `get_stats(client_id?)` | Get DOI registration statistics | 1¢ |

## Parameters

### get_doi
- `doi` (string, required) — DOI identifier (e.g. 10.1234/example)

### search_dois
- `query` (string, required) — Search query
- `limit` (number) — Max results (default: 10, max: 100)

### get_stats
- `client_id` (string) — DataCite client ID for institution-specific stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DataCite API — it is completely free.

## Upstream API

- **Provider**: DataCite
- **Base URL**: https://api.datacite.org/dois
- **Auth**: None required
- **Docs**: https://support.datacite.org/docs/api

## Deploy

### Docker

```bash
docker build -t settlegrid-datacite .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-datacite
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
