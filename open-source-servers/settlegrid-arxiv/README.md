# settlegrid-arxiv

arXiv MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-arxiv)

Search academic preprints on arXiv via the Atom/XML API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query, max_results)` | Search arXiv papers by query | 1¢ |
| `get_paper(id)` | Get paper details by arXiv ID | 1¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query (e.g. "quantum computing")
- `max_results` (number, optional) — Max results (1-50, default 10)

### get_paper
- `id` (string, required) — arXiv paper ID (e.g. "2301.07041")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: arXiv
- **Base URL**: https://export.arxiv.org/api/query
- **Auth**: None required
- **Rate Limits**: 3 req/s
- **Docs**: https://info.arxiv.org/help/api/index.html

## Deploy

### Docker

```bash
docker build -t settlegrid-arxiv .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-arxiv
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
