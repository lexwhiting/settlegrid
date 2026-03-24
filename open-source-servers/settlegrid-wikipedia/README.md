# settlegrid-wikipedia

Wikipedia MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-wikipedia)

Article summaries, full-text search, and random articles from Wikipedia. Supports 20 languages. The most universally useful data source for AI agents.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_summary(title)` | Article summary with extract and thumbnail | 1¢ |
| `search(query)` | Full-text search across Wikipedia | 1¢ |
| `get_random()` | Random featured article summary | 1¢ |

## Parameters

### get_summary
- `title` (string, required) — Article title (e.g. "Albert Einstein", "Photosynthesis")
- `lang` (string, optional) — Language code (default "en")

### search
- `query` (string, required) — Search text (e.g. "machine learning")
- `limit` (number, optional) — Max results (default 10, max 50)
- `lang` (string, optional) — Language code (default "en")

### get_random
- `lang` (string, optional) — Language code (default "en")

## Supported Languages

en, es, fr, de, ja, zh, ru, pt, it, ar, ko, nl, pl, sv, uk, vi, he, id, tr, cs

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Wikipedia API.

## Upstream API

- **Provider**: Wikimedia Foundation
- **APIs Used**: REST v1 (summaries, random) + Action API (search)
- **Auth**: None required
- **Rate Limits**: Reasonable use with User-Agent header
- **Docs**: https://en.wikipedia.org/api/rest_v1/

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
