# settlegrid-semantic-scholar

Semantic Scholar MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-semantic-scholar)

Search AI and computer science papers via Semantic Scholar API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + S2_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query, limit)` | Search Semantic Scholar papers | 1¢ |
| `get_paper(paper_id)` | Get paper by Semantic Scholar ID or DOI | 1¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results (1-20, default 10)

### get_paper
- `paper_id` (string, required) — Paper ID, DOI, or arXiv ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `S2_API_KEY` | Yes | Semantic Scholar API key (optional) |


## Upstream API

- **Provider**: Semantic Scholar
- **Base URL**: https://api.semanticscholar.org/graph/v1
- **Auth**: Free API key recommended
- **Rate Limits**: 100 req/5min without key
- **Docs**: https://api.semanticscholar.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-semantic-scholar .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e S2_API_KEY=xxx -p 3000:3000 settlegrid-semantic-scholar
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
