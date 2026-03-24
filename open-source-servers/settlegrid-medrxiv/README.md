# settlegrid-medrxiv

medRxiv Medical Preprints MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-medrxiv)

Access medical and health science preprints from medRxiv including recent papers, search, and details. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recent(days?, limit?)` | Get recent medical preprints | 1¢ |
| `search_papers(query)` | Search medical preprints | 1¢ |
| `get_paper(doi)` | Get paper by DOI | 1¢ |

## Parameters

### get_recent
- `days` (number) — Days to look back (default: 7, max: 30)
- `limit` (number) — Max results (default: 20, max: 100)

### search_papers
- `query` (string, required) — Search query for medical papers

### get_paper
- `doi` (string, required) — medRxiv DOI

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream medRxiv API — it is completely free.

## Upstream API

- **Provider**: medRxiv
- **Base URL**: https://api.biorxiv.org/details/medrxiv
- **Auth**: None required
- **Docs**: https://api.biorxiv.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-medrxiv .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-medrxiv
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
