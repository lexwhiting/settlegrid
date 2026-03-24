# settlegrid-openlibrary-books

Open Library Books MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-openlibrary-books)

Book search and ISBN lookup from Open Library / Internet Archive.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_books(query, limit?)` | Search books | 1¢ |
| `get_book_by_isbn(isbn)` | Get book by ISBN | 1¢ |

## Parameters

### search_books
- `query` (string, required) — Book title or author
- `limit` (number) — Max results (default 10)

### get_book_by_isbn
- `isbn` (string, required) — ISBN-10 or ISBN-13

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open Library API — it is completely free.

## Upstream API

- **Provider**: Open Library
- **Base URL**: https://openlibrary.org
- **Auth**: None required
- **Docs**: https://openlibrary.org/dev/docs/api/books

## Deploy

### Docker

```bash
docker build -t settlegrid-openlibrary-books .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-openlibrary-books
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
