# settlegrid-isbndb

ISBNdb MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-isbndb)

Look up books by ISBN with detailed metadata from ISBNdb with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + ISBNDB_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_book(isbn)` | Get book details by ISBN | 2¢ |
| `search_books(query, page)` | Search books by title or query | 2¢ |

## Parameters

### get_book
- `isbn` (string, required) — ISBN-10 or ISBN-13

### search_books
- `query` (string, required) — Search query
- `page` (number, optional) — Page number (default 1)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ISBNDB_API_KEY` | Yes | ISBNdb API key |


## Upstream API

- **Provider**: ISBNdb
- **Base URL**: https://api2.isbndb.com
- **Auth**: API key required
- **Rate Limits**: 1 req/s (free tier)
- **Docs**: https://isbndb.com/apidocs/v2

## Deploy

### Docker

```bash
docker build -t settlegrid-isbndb .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e ISBNDB_API_KEY=xxx -p 3000:3000 settlegrid-isbndb
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
