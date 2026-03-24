# settlegrid-venture-capital

Venture Capital & Startups MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-venture-capital)

Search startup/VC data using GitHub as a proxy for tech startups. Explore trending tech projects.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_startups(query)` | Search tech startups/projects | 1¢ |
| `get_funding_rounds(company)` | Get project activity as funding proxy | 1¢ |
| `list_recent(limit?)` | List trending tech projects | 1¢ |

## Parameters

### search_startups
- `query` (string, required) — Search query for startups/projects

### get_funding_rounds
- `company` (string, required) — GitHub org or company name

### list_recent
- `limit` (number) — Number of results (default: 10)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream GitHub API API — it is completely free.

## Upstream API

- **Provider**: GitHub API
- **Base URL**: https://api.github.com
- **Auth**: None required
- **Docs**: https://docs.github.com/en/rest

## Deploy

### Docker

```bash
docker build -t settlegrid-venture-capital .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-venture-capital
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
