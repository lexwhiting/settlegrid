# settlegrid-crowdfunding

Crowdfunding Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-crowdfunding)

Kickstarter and crowdfunding project data. Search projects, view stats, and discover trending campaigns.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_projects(query, category?)` | Search crowdfunding projects | 1¢ |
| `get_stats(category)` | Get category statistics | 1¢ |
| `get_trending(limit?)` | Get trending projects | 1¢ |

## Parameters

### search_projects
- `query` (string, required) — Search query
- `category` (string) — Category filter (technology, design, games, etc.)

### get_stats
- `category` (string, required) — Category name

### get_trending
- `limit` (number) — Number of results (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Kickstarter API — it is completely free.

## Upstream API

- **Provider**: Kickstarter
- **Base URL**: https://www.kickstarter.com/discover/advanced.json
- **Auth**: None required
- **Docs**: https://www.kickstarter.com/discover

## Deploy

### Docker

```bash
docker build -t settlegrid-crowdfunding .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-crowdfunding
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
