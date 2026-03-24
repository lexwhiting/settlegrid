# settlegrid-harvard-art

Harvard Art Museums MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-harvard-art)

Search and explore the Harvard Art Museums collections spanning 250,000+ objects.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_objects(query, limit?)` | Search Harvard Art Museums objects | 1¢ |
| `get_object(id)` | Get object by ID | 1¢ |
| `search_people(query)` | Search people (artists, makers) | 1¢ |

## Parameters

### search_objects
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_object
- `id` (number, required) — Harvard Art Museums object ID

### search_people
- `query` (string, required) — Person name to search

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `HAM_API_KEY` | Yes | Harvard Art Museums API API key from [https://harvardartmuseums.org/collections/api](https://harvardartmuseums.org/collections/api) |

## Upstream API

- **Provider**: Harvard Art Museums API
- **Base URL**: https://api.harvardartmuseums.org
- **Auth**: API key required
- **Docs**: https://github.com/harvardartmuseums/api-docs

## Deploy

### Docker

```bash
docker build -t settlegrid-harvard-art .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-harvard-art
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
