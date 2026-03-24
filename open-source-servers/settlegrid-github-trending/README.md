# settlegrid-github-trending

GitHub Trending MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-github-trending)

Trending repositories and developers on GitHub

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_trending_repos()` | Get trending repositories | 1¢ |
| `get_trending_developers()` | Get trending developers | 1¢ |

## Parameters

### get_trending_repos
- `language` (string, optional) — Programming language filter
- `since` (string, optional) — Period: daily, weekly, monthly (default: "daily")

### get_trending_developers
- `language` (string, optional) — Programming language filter
- `since` (string, optional) — Period: daily, weekly, monthly (default: "daily")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GitHub Trending API.

## Upstream API

- **Provider**: GitHub Trending
- **Base URL**: https://api.gitterapp.com
- **Auth**: None required
- **Docs**: https://github.com/trending

## Deploy

### Docker

```bash
docker build -t settlegrid-github-trending .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-github-trending
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
