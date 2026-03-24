# settlegrid-mdn-search

MDN Web Docs MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mdn-search)

Search Mozilla Developer Network web documentation.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_docs(query)` | Search MDN web documentation articles | 1¢ |
| `get_document(slug)` | Get a specific MDN document by slug | 1¢ |

## Parameters

### search_docs
- `query` (string, required)

### get_document
- `slug` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Mozilla
- **Base URL**: https://developer.mozilla.org
- **Auth**: None required
- **Rate Limits**: No published rate limit (be respectful)
- **Docs**: https://developer.mozilla.org/en-US/docs/MDN/Writing_guidelines

## Deploy

### Docker

```bash
docker build -t settlegrid-mdn-search .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mdn-search
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
