# settlegrid-core-api

CORE Open Access Papers MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-core-api)

Search and access millions of open access research papers and metadata via the CORE API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query, limit?)` | Search open access papers | 1¢ |
| `get_paper(id)` | Get paper by CORE ID | 1¢ |
| `search_journals(query)` | Search journals | 1¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query
- `limit` (number) — Max results (default: 10, max: 100)

### get_paper
- `id` (string, required) — CORE paper ID or DOI

### search_journals
- `query` (string, required) — Journal name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CORE_API_KEY` | Yes | CORE API key from [https://core.ac.uk/services/api](https://core.ac.uk/services/api) |

## Upstream API

- **Provider**: CORE
- **Base URL**: https://api.core.ac.uk/v3
- **Auth**: API key required
- **Docs**: https://core.ac.uk/documentation/api

## Deploy

### Docker

```bash
docker build -t settlegrid-core-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-core-api
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
