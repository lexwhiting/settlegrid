# settlegrid-smithsonian

Smithsonian Open Access MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-smithsonian)

Search the Smithsonian Institution open-access collection spanning 20+ museums and research centers.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_objects(query, limit?)` | Search Smithsonian objects | 1¢ |
| `get_object(id)` | Get object by Smithsonian ID | 1¢ |
| `get_stats()` | Get Smithsonian collection statistics | 1¢ |

## Parameters

### search_objects
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_object
- `id` (string, required) — Smithsonian object ID

### get_stats

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `SMITHSONIAN_API_KEY` | Yes | Smithsonian Open Access API API key from [https://api.si.edu](https://api.si.edu) |

## Upstream API

- **Provider**: Smithsonian Open Access API
- **Base URL**: https://api.si.edu/openaccess/api/v1.0
- **Auth**: API key required
- **Docs**: https://edan.si.edu/openaccess/apidocs/

## Deploy

### Docker

```bash
docker build -t settlegrid-smithsonian .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-smithsonian
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
