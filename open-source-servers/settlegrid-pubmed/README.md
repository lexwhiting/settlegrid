# settlegrid-pubmed

PubMed/NCBI MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pubmed)

Search biomedical literature from PubMed/NCBI database

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(term)` | Search PubMed articles | 1¢ |
| `get_summary(id)` | Get article summaries by PubMed IDs | 1¢ |

## Parameters

### search
- `term` (string, required) — Search term
- `retmax` (number, optional) — Max results (default: 20)

### get_summary
- `id` (string, required) — Comma-separated PubMed IDs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream PubMed/NCBI API.

## Upstream API

- **Provider**: PubMed/NCBI
- **Base URL**: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- **Auth**: None required
- **Docs**: https://www.ncbi.nlm.nih.gov/books/NBK25497/

## Deploy

### Docker

```bash
docker build -t settlegrid-pubmed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-pubmed
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
