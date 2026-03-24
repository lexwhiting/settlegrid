# settlegrid-pubmed

PubMed MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-pubmed)

Search biomedical literature on PubMed/NCBI with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + NCBI_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(query, max_results)` | Search PubMed articles | 1¢ |
| `get_abstract(pmid)` | Get article abstract by PMID | 1¢ |

## Parameters

### search_articles
- `query` (string, required) — Search query
- `max_results` (number, optional) — Max results (1-20, default 10)

### get_abstract
- `pmid` (string, required) — PubMed ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `NCBI_API_KEY` | Yes | NCBI API key (optional, increases rate limit) |


## Upstream API

- **Provider**: NCBI
- **Base URL**: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- **Auth**: Free API key recommended
- **Rate Limits**: 3 req/s without key, 10 with
- **Docs**: https://www.ncbi.nlm.nih.gov/books/NBK25501/

## Deploy

### Docker

```bash
docker build -t settlegrid-pubmed .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e NCBI_API_KEY=xxx -p 3000:3000 settlegrid-pubmed
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
