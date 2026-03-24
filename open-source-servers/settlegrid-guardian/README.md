# settlegrid-guardian

The Guardian MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-guardian)

Search articles from The Guardian newspaper.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GUARDIAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_articles(q, section)` | Search Guardian articles by keyword | 2¢ |
| `get_article(id)` | Get a Guardian article by ID path | 2¢ |
| `list_sections()` | List available Guardian sections | 2¢ |

## Parameters

### search_articles
- `q` (string, required)
- `section` (string, optional)

### get_article
- `id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GUARDIAN_API_KEY` | Yes | Free key from open-platform.theguardian.com |


## Upstream API

- **Provider**: The Guardian
- **Base URL**: https://content.guardianapis.com
- **Auth**: Free API key required
- **Rate Limits**: 12 req/s, 5000/day (free)
- **Docs**: https://open-platform.theguardian.com/documentation/

## Deploy

### Docker

```bash
docker build -t settlegrid-guardian .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GUARDIAN_API_KEY=xxx -p 3000:3000 settlegrid-guardian
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
