# settlegrid-lens-org

Lens.org Patent & Scholarly Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-lens-org)

Search patents and scholarly articles via the Lens.org API. Free API key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_scholarly(query, limit?)` | Search scholarly articles | 2¢ |
| `search_patents(query, limit?)` | Search patents | 2¢ |
| `get_record(id)` | Get scholarly record by Lens ID | 1¢ |

## Parameters

### search_scholarly
- `query` (string, required) — Search query for scholarly articles
- `limit` (number) — Max results (default: 10, max: 50)

### search_patents
- `query` (string, required) — Search query for patents
- `limit` (number) — Max results (default: 10, max: 50)

### get_record
- `id` (string, required) — Lens ID of the scholarly record

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `LENS_API_KEY` | Yes | Lens.org API key from [https://www.lens.org/lens/user/subscriptions](https://www.lens.org/lens/user/subscriptions) |

## Upstream API

- **Provider**: Lens.org
- **Base URL**: https://api.lens.org
- **Auth**: API key required
- **Docs**: https://docs.api.lens.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-lens-org .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-lens-org
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
