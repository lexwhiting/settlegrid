# settlegrid-gutenberg-books

Gutenberg Books MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gutenberg-books)

Search and access free public domain books from Project Gutenberg.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_gutenberg(query, limit?)` | Search Gutenberg books | 1¢ |
| `get_book(id)` | Get book by ID | 1¢ |

## Parameters

### search_gutenberg
- `query` (string, required) — Search term
- `limit` (number) — Max results

### get_book
- `id` (number, required) — Gutenberg book ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Gutendex API — it is completely free.

## Upstream API

- **Provider**: Gutendex
- **Base URL**: https://gutendex.com
- **Auth**: None required
- **Docs**: https://gutendex.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-gutenberg-books .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gutenberg-books
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
