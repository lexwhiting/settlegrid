# settlegrid-open-alex

OpenAlex MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-open-alex)

Search academic works, authors, and institutions from OpenAlex with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_works(query, per_page)` | Search academic works | 1¢ |
| `get_author(author_id)` | Get author profile by OpenAlex ID | 1¢ |
| `search_institutions(query)` | Search research institutions | 1¢ |

## Parameters

### search_works
- `query` (string, required) — Search query
- `per_page` (number, optional) — Results per page (1-20, default 10)

### get_author
- `author_id` (string, required) — OpenAlex author ID (e.g. "A5023888391")

### search_institutions
- `query` (string, required) — Institution name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: OpenAlex
- **Base URL**: https://api.openalex.org
- **Auth**: None required
- **Rate Limits**: 100k req/day polite
- **Docs**: https://docs.openalex.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-open-alex .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-open-alex
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
