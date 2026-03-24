# settlegrid-bioarxiv

bioRxiv Biology Preprints MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bioarxiv)

Access biology preprints from bioRxiv including recent papers, search, and paper details. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_recent(days?, limit?)` | Get recent biology preprints | 1¢ |
| `search_papers(query)` | Search biology preprints | 1¢ |
| `get_paper(doi)` | Get paper by DOI | 1¢ |

## Parameters

### get_recent
- `days` (number) — Number of days to look back (default: 7, max: 30)
- `limit` (number) — Max results (default: 20, max: 100)

### search_papers
- `query` (string, required) — Search query for biology papers

### get_paper
- `doi` (string, required) — bioRxiv DOI (e.g. 10.1101/2024.01.01.123456)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream bioRxiv API — it is completely free.

## Upstream API

- **Provider**: bioRxiv
- **Base URL**: https://api.biorxiv.org/details/biorxiv
- **Auth**: None required
- **Docs**: https://api.biorxiv.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-bioarxiv .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bioarxiv
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
