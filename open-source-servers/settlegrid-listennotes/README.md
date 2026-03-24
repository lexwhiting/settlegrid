# settlegrid-listennotes

Listen Notes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-listennotes)

Search podcasts and episodes via the Listen Notes API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + LISTENNOTES_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_podcasts(q)` | Search podcasts by keyword | 2¢ |
| `search_episodes(q)` | Search episodes by keyword | 2¢ |
| `get_podcast(id)` | Get podcast details by ID | 2¢ |

## Parameters

### search_podcasts
- `q` (string, required)

### search_episodes
- `q` (string, required)

### get_podcast
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LISTENNOTES_API_KEY` | Yes | API key from listennotes.com |


## Upstream API

- **Provider**: Listen Notes
- **Base URL**: https://listen-api.listennotes.com/api/v2
- **Auth**: Free API key required
- **Rate Limits**: 5 req/s (free)
- **Docs**: https://www.listennotes.com/api/docs/

## Deploy

### Docker

```bash
docker build -t settlegrid-listennotes .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e LISTENNOTES_API_KEY=xxx -p 3000:3000 settlegrid-listennotes
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
