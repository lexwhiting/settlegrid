# settlegrid-gutenberg

Project Gutenberg MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gutenberg)

Search and retrieve free ebooks from Project Gutenberg via the Gutendex API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_books(query)` | Search free ebooks by title, author, or topic | 1¢ |
| `get_book(id)` | Get full details for a specific book by ID | 1¢ |
| `get_popular(topic)` | Get most popular/downloaded free ebooks | 1¢ |

## Parameters

### search_books
- `query` (string, required) — Search query (title, author, topic)

### get_book
- `id` (number, required) — Gutenberg book ID

### get_popular
- `topic` (string, optional) — Optional topic filter (e.g. "science", "fiction")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Gutendex
- **Base URL**: https://gutendex.com
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://gutendex.com

## Deploy

### Docker

```bash
docker build -t settlegrid-gutenberg .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-gutenberg
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
