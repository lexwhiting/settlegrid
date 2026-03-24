# settlegrid-google-scholar

Google Scholar Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-google-scholar)

Search academic papers, retrieve metadata, and find citations via Semantic Scholar API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query, limit?)` | Search for academic papers | 1¢ |
| `get_paper(paperId)` | Get paper details by ID | 1¢ |
| `get_citations(paperId, limit?)` | Get citations for a paper | 2¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query for papers
- `limit` (number) — Max results to return (default: 10, max: 100)

### get_paper
- `paperId` (string, required) — Semantic Scholar paper ID, DOI, or ArXiv ID

### get_citations
- `paperId` (string, required) — Semantic Scholar paper ID
- `limit` (number) — Max citations to return (default: 20, max: 1000)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Semantic Scholar API — it is completely free.

## Upstream API

- **Provider**: Semantic Scholar
- **Base URL**: https://api.semanticscholar.org/graph/v1
- **Auth**: None required
- **Docs**: https://api.semanticscholar.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-google-scholar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-google-scholar
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
