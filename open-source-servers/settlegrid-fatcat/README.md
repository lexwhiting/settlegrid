# settlegrid-fatcat

Fatcat Scholarly Catalog MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fatcat)

Search and retrieve scholarly metadata from the Fatcat open catalog of research papers, journals, and files.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_releases(query, limit?)` | Search scholarly releases | 1¢ |
| `get_release(id)` | Get release by ID | 1¢ |
| `get_container(id)` | Get journal/container by ID | 1¢ |

## Parameters

### search_releases
- `query` (string, required) — Search query for releases (papers/articles)
- `limit` (number) — Max results (default: 10, max: 50)

### get_release
- `id` (string, required) — Fatcat release ID (e.g. hsmo6p4smrganpb3fndaj2lon4)

### get_container
- `id` (string, required) — Fatcat container ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Fatcat API — it is completely free.

## Upstream API

- **Provider**: Fatcat
- **Base URL**: https://api.fatcat.wiki/v0
- **Auth**: None required
- **Docs**: https://api.fatcat.wiki/

## Deploy

### Docker

```bash
docker build -t settlegrid-fatcat .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-fatcat
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
