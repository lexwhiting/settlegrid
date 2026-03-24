# settlegrid-crossref

Crossref MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-crossref)

Scholarly metadata for 130M+ works with DOI resolution

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_works(query)` | Search scholarly works | 1¢ |
| `get_work(doi)` | Get work metadata by DOI | 1¢ |

## Parameters

### search_works
- `query` (string, required) — Search query
- `rows` (number, optional) — Results count (default: 20)

### get_work
- `doi` (string, required) — DOI (e.g. 10.1038/nature12373)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Crossref API.

## Upstream API

- **Provider**: Crossref
- **Base URL**: https://api.crossref.org
- **Auth**: None required
- **Docs**: https://api.crossref.org/swagger-ui/index.html

## Deploy

### Docker

```bash
docker build -t settlegrid-crossref .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-crossref
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
