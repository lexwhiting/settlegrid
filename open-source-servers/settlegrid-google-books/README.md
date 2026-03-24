# settlegrid-google-books

Google Books MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-google-books)

Search books, get volume details, and browse bookshelves via the Google Books API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GOOGLE_BOOKS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_volumes(query, maxResults)` | Search books by title, author, ISBN, or keyword | 1¢ |
| `get_volume(volumeId)` | Get detailed info for a specific volume by ID | 1¢ |

## Parameters

### search_volumes
- `query` (string, required) — Search query (title, author, ISBN)
- `maxResults` (number, optional) — Max results 1-40 (default 10)

### get_volume
- `volumeId` (string, required) — Google Books volume ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GOOGLE_BOOKS_API_KEY` | Yes | Google Books API key (optional, increases quota) |


## Upstream API

- **Provider**: Google
- **Base URL**: https://www.googleapis.com/books/v1
- **Auth**: Free API key (optional for basic use)
- **Rate Limits**: 1000 requests/day free
- **Docs**: https://developers.google.com/books/docs/v1/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-google-books .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GOOGLE_BOOKS_API_KEY=xxx -p 3000:3000 settlegrid-google-books
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
