# settlegrid-british-museum

British Museum Collection MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-british-museum)

Search and explore the British Museum collection of over 4.5 million objects spanning human history.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_objects(query, limit?)` | Search British Museum objects | 2¢ |
| `get_object(id)` | Get object by ID | 1¢ |
| `search_by_period(period)` | Search objects by historical period | 2¢ |

## Parameters

### search_objects
- `query` (string, required) — Search query
- `limit` (number) — Max results (default 10)

### get_object
- `id` (string, required) — British Museum object ID

### search_by_period
- `period` (string, required) — Historical period (e.g. Roman, Medieval, Egyptian)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream British Museum Collection API — it is completely free.

## Upstream API

- **Provider**: British Museum Collection
- **Base URL**: https://collection.britishmuseum.org
- **Auth**: None required
- **Docs**: https://collection.britishmuseum.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-british-museum .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-british-museum
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
