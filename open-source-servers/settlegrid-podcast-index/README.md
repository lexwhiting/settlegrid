# settlegrid-podcast-index

Podcast Index MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-podcast-index)

Search podcasts and episodes via the Podcast Index API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PODCAST_INDEX_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_podcasts(q)` | Search podcasts by keyword | 2¢ |
| `get_podcast(id)` | Get podcast details by feed ID | 2¢ |
| `get_episodes(id)` | Get recent episodes of a podcast | 2¢ |

## Parameters

### search_podcasts
- `q` (string, required)

### get_podcast
- `id` (number, required)

### get_episodes
- `id` (number, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `PODCAST_INDEX_KEY` | Yes | API key from podcastindex.org |


## Upstream API

- **Provider**: Podcast Index
- **Base URL**: https://api.podcastindex.org/api/1.0
- **Auth**: Free API key required
- **Rate Limits**: 300 req/min
- **Docs**: https://podcastindex-org.github.io/docs-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-podcast-index .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PODCAST_INDEX_KEY=xxx -p 3000:3000 settlegrid-podcast-index
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
