# settlegrid-openlibrary

Open Library MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openlibrary)

Search books and authors from the Open Library (Internet Archive) with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_books(query, limit)` | Search books by title, author, or subject | 1¢ |
| `get_book(isbn)` | Get book details by ISBN | 1¢ |

## Parameters

### search_books
- `query` (string, required) — Search query
- `limit` (number, optional) — Max results (1-20, default 10)

### get_book
- `isbn` (string, required) — ISBN-10 or ISBN-13

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Internet Archive
- **Base URL**: https://openlibrary.org
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://openlibrary.org/developers/api

## Deploy

### Docker

```bash
docker build -t settlegrid-openlibrary .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openlibrary
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
