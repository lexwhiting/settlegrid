# settlegrid-linguistics

Language Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-linguistics)

Access language and linguistic data via Glottolog. Search languages, get language details, and list language families.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_languages(query)` | Search languages by name | 1¢ |
| `get_language(id)` | Get language details by Glottocode | 1¢ |
| `list_families()` | List top-level language families | 2¢ |

## Parameters

### search_languages
- `query` (string, required) — Language name (e.g. "Mandarin", "Swahili")

### get_language
- `id` (string, required) — Glottocode (e.g. stan1293 for English)

### list_families

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Glottolog API API — it is completely free.

## Upstream API

- **Provider**: Glottolog API
- **Base URL**: https://glottolog.org/glottolog
- **Auth**: None required
- **Docs**: https://glottolog.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-linguistics .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-linguistics
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
