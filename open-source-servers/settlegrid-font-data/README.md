# settlegrid-font-data

Google Fonts Metadata MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-font-data)

Browse, search, and retrieve metadata for Google Fonts including families, categories, and variants.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_fonts(sort?, category?)` | List Google Fonts | 1¢ |
| `get_font(family)` | Get font family details | 1¢ |
| `search_fonts(query)` | Search fonts by name | 1¢ |

## Parameters

### list_fonts
- `sort` (string) — Sort by: alpha, date, popularity, style, trending
- `category` (string) — Filter by category: serif, sans-serif, display, handwriting, monospace

### get_font
- `family` (string, required) — Font family name (e.g. Roboto)

### search_fonts
- `query` (string, required) — Font name search query

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Google Fonts API API — it is completely free.

## Upstream API

- **Provider**: Google Fonts API
- **Base URL**: https://www.googleapis.com/webfonts/v1
- **Auth**: None required
- **Docs**: https://developers.google.com/fonts/docs/developer_api

## Deploy

### Docker

```bash
docker build -t settlegrid-font-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-font-data
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
