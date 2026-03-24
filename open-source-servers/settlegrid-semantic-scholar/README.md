# settlegrid-semantic-scholar

Semantic Scholar MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-semantic-scholar)

AI-powered academic paper search with citation graphs from S2

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query)` | Search academic papers | 1¢ |
| `get_paper(paperId)` | Get paper details by ID | 1¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results (default: 20)
- `fields` (string, optional) — Fields to return (default: "title,year,abstract,citationCount,authors")

### get_paper
- `paperId` (string, required) — Semantic Scholar paper ID or DOI
- `fields` (string, optional) — Fields to return (default: "title,year,abstract,citationCount,authors,references")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Semantic Scholar API.

## Upstream API

- **Provider**: Semantic Scholar
- **Base URL**: https://api.semanticscholar.org/graph/v1
- **Auth**: None required
- **Docs**: https://api.semanticscholar.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-semantic-scholar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-semantic-scholar
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
