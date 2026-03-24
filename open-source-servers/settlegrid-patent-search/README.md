# settlegrid-patent-search

USPTO Patent Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-patent-search)

Search US patents and patent applications via the USPTO Patent API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_patents(query, rows)` | Search US patents by keyword | 1¢ |
| `get_patent(patent_number)` | Get patent details by patent number | 1¢ |

## Parameters

### search_patents
- `query` (string, required) — Search query (keywords, inventor, assignee)
- `rows` (number, optional) — Results per page 1-50 (default 10)

### get_patent
- `patent_number` (string, required) — US patent number (e.g. "11234567")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: USPTO
- **Base URL**: https://developer.uspto.gov/ibd-api/v1
- **Auth**: None required
- **Rate Limits**: See USPTO terms
- **Docs**: https://developer.uspto.gov/api-catalog

## Deploy

### Docker

```bash
docker build -t settlegrid-patent-search .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-patent-search
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
