# settlegrid-unpaywall

Unpaywall Open Access Finder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-unpaywall)

Find free, legal open access versions of research papers by DOI via the Unpaywall API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_access(doi)` | Get OA status and links for a DOI | 1¢ |
| `check_oa(doi)` | Quick OA check for a DOI | 1¢ |
| `search_oa(query)` | Search for OA papers via OpenAlex | 1¢ |

## Parameters

### get_access
- `doi` (string, required) — DOI of the article (e.g. 10.1038/nature12373)

### check_oa
- `doi` (string, required) — DOI to check for open access

### search_oa
- `query` (string, required) — Search query for open access papers

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Unpaywall API — it is completely free.

## Upstream API

- **Provider**: Unpaywall
- **Base URL**: https://api.unpaywall.org/v2
- **Auth**: None required
- **Docs**: https://unpaywall.org/products/api

## Deploy

### Docker

```bash
docker build -t settlegrid-unpaywall .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-unpaywall
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
