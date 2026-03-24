# settlegrid-worldcat

WorldCat Library Catalog MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-worldcat)

Search the world's largest library catalog via WorldCat API for books, media, and library holdings.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_books(query, limit?)` | Search WorldCat books and media | 2¢ |
| `get_book(oclcNumber)` | Get book by OCLC number | 1¢ |
| `search_libraries(zip)` | Search libraries by zip code | 2¢ |

## Parameters

### search_books
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_book
- `oclcNumber` (string, required) — OCLC catalog number

### search_libraries
- `zip` (string, required) — ZIP/postal code to search near

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WORLDCAT_API_KEY` | Yes | WorldCat Search API API key from [https://www.oclc.org/developer](https://www.oclc.org/developer) |

## Upstream API

- **Provider**: WorldCat Search API
- **Base URL**: https://search.worldcat.org/api
- **Auth**: API key required
- **Docs**: https://www.oclc.org/developer/develop/web-services/worldcat-search-api.en.html

## Deploy

### Docker

```bash
docker build -t settlegrid-worldcat .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-worldcat
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
