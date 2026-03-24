# settlegrid-doaj

DOAJ Open Access Journals MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-doaj)

Search the Directory of Open Access Journals for articles, journals, and metadata. Free and open.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(query, limit?)` | Search open access articles | 1¢ |
| `search_journals(query, limit?)` | Search open access journals | 1¢ |
| `get_journal(issn)` | Get journal by ISSN | 1¢ |

## Parameters

### search_articles
- `query` (string, required) — Search query for articles
- `limit` (number) — Max results (default: 10, max: 100)

### search_journals
- `query` (string, required) — Search query for journals
- `limit` (number) — Max results (default: 10, max: 100)

### get_journal
- `issn` (string, required) — Journal ISSN (e.g. 1234-5678)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream DOAJ API — it is completely free.

## Upstream API

- **Provider**: DOAJ
- **Base URL**: https://doaj.org/api
- **Auth**: None required
- **Docs**: https://doaj.org/api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-doaj .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-doaj
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
