# settlegrid-courtlistener

US Court Opinions MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-courtlistener)

Search US court opinions, cases, and judges via the CourtListener API. Free API key required.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_opinions(query, court?, limit?)` | Search court opinions | 2¢ |
| `get_opinion(id)` | Get a specific opinion by ID | 2¢ |
| `search_judges(query)` | Search judges | 2¢ |

## Parameters

### search_opinions
- `query` (string, required) — Search query for court opinions
- `court` (string) — Court filter (e.g. scotus, ca9)
- `limit` (number) — Max results to return (default 20)

### get_opinion
- `id` (string, required) — Opinion ID

### search_judges
- `query` (string, required) — Judge name or keyword

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `COURTLISTENER_API_KEY` | Yes | CourtListener API key from [https://www.courtlistener.com/help/api/](https://www.courtlistener.com/help/api/) |

## Upstream API

- **Provider**: CourtListener
- **Base URL**: https://www.courtlistener.com/api/rest/v4
- **Auth**: API key required
- **Docs**: https://www.courtlistener.com/help/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-courtlistener .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-courtlistener
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
