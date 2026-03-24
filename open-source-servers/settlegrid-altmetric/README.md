# settlegrid-altmetric

Altmetric Research Impact MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-altmetric)

Retrieve research impact and attention data including social media mentions, news, and policy citations via Altmetric.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_article(doi)` | Get altmetric data for a DOI | 1¢ |
| `get_citations(doi)` | Get citation breakdown for a DOI | 2¢ |
| `search_articles(query)` | Search by keyword | 1¢ |

## Parameters

### get_article
- `doi` (string, required) — Article DOI (e.g. 10.1038/nature12373)

### get_citations
- `doi` (string, required) — Article DOI

### search_articles
- `query` (string, required) — Search query for articles with altmetric data

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ALTMETRIC_API_KEY` | No | Altmetric API key from [https://www.altmetric.com/products/altmetric-api/](https://www.altmetric.com/products/altmetric-api/) |

## Upstream API

- **Provider**: Altmetric
- **Base URL**: https://api.altmetric.com/v1
- **Auth**: API key required
- **Docs**: https://www.altmetric.com/products/altmetric-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-altmetric .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-altmetric
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
