# settlegrid-archaeology

Archaeological Site Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-archaeology)

Access archaeological site data via Open Context. Search sites, get item details, and list research projects.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sites(query, limit?)` | Search archaeological sites | 1¢ |
| `get_item(id)` | Get item details by ID | 1¢ |
| `list_projects()` | List archaeological projects | 1¢ |

## Parameters

### search_sites
- `query` (string, required) — Search query (e.g. "pottery", "Roman")
- `limit` (number) — Max results (default 10, max 50)

### get_item
- `id` (string, required) — Open Context item UUID or path

### list_projects

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Open Context API API — it is completely free.

## Upstream API

- **Provider**: Open Context API
- **Base URL**: https://opencontext.org/search/.json
- **Auth**: None required
- **Docs**: https://opencontext.org/about/services

## Deploy

### Docker

```bash
docker build -t settlegrid-archaeology .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-archaeology
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
