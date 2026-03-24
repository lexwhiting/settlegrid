# settlegrid-europe-pmc

Europe PMC MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-europe-pmc)

Search and retrieve biomedical and life science articles from European PubMed Central. Free and open access.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(query, limit?)` | Search biomedical articles | 1¢ |
| `get_article(id, source?)` | Get article by ID | 1¢ |
| `get_citations(id)` | Get citations for an article | 2¢ |

## Parameters

### search_articles
- `query` (string, required) — Search query (supports EuropePMC syntax)
- `limit` (number) — Max results (default: 10, max: 100)

### get_article
- `id` (string, required) — Article ID (PMID, PMC ID, or DOI)
- `source` (string) — Source database: MED, PMC, or DOI (default: MED)

### get_citations
- `id` (string, required) — PubMed ID (PMID) of the article

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Europe PMC API — it is completely free.

## Upstream API

- **Provider**: Europe PMC
- **Base URL**: https://www.ebi.ac.uk/europepmc/webservices/rest
- **Auth**: None required
- **Docs**: https://europepmc.org/RestfulWebService

## Deploy

### Docker

```bash
docker build -t settlegrid-europe-pmc .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-europe-pmc
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
