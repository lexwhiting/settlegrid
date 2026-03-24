# settlegrid-math-genealogy

Mathematics Genealogy MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-math-genealogy)

Search mathematicians, their works, and academic lineage via OpenAlex API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_mathematicians(name)` | Search mathematicians by name | 1¢ |
| `get_author(id)` | Get author profile | 1¢ |
| `get_works(authorId, limit?)` | Get works by an author | 2¢ |

## Parameters

### search_mathematicians
- `name` (string, required) — Mathematician name to search

### get_author
- `id` (string, required) — OpenAlex author ID

### get_works
- `authorId` (string, required) — OpenAlex author ID
- `limit` (number) — Max results (default: 20, max: 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenAlex API — it is completely free.

## Upstream API

- **Provider**: OpenAlex
- **Base URL**: https://api.openalex.org
- **Auth**: None required
- **Docs**: https://docs.openalex.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-math-genealogy .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-math-genealogy
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
