# settlegrid-weglot

Weglot MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-weglot)

Translate, retrieve, and update website content across multiple languages using the Weglot translation API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `translate_content(l_from: string, l_to: string, words: Array<{ w: string; t: number }>, request_url?: string)` | Translate an array of text strings from one language to another | 3¢ |
| `get_api_status()` | Check Weglot API status and validate the API key | 1¢ |
| `get_translations(l_from?: string, l_to?: string)` | Retrieve existing translations for a language pair | 1¢ |
| `update_translations(l_from: string, l_to: string, words: Array<{ w: string; t: number; to?: string }>)` | Create or update translations for a language pair | 3¢ |

## Parameters

### translate_content
- `l_from` (string, required) — BCP 47 source language code (e.g. en, fr, de)
- `l_to` (string, required) — BCP 47 target language code (e.g. fr, es, ja)
- `words` (array, required) — Array of word objects with 'w' (text) and 't' (type: 1=text, 2=HTML) fields
- `request_url` (string) — URL of the page being translated (for context)

### get_api_status

### get_translations
- `l_from` (string) — BCP 47 source language code to filter by (e.g. en)
- `l_to` (string) — BCP 47 target language code to filter by (e.g. fr)

### update_translations
- `l_from` (string, required) — BCP 47 source language code (e.g. en)
- `l_to` (string, required) — BCP 47 target language code (e.g. fr)
- `words` (array, required) — Array of word objects with 'w' (original text), 't' (type), and 'to' (translated text) fields

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WEGLOT_API_KEY` | Yes | Weglot API key from [https://dashboard.weglot.com/settings/setup](https://dashboard.weglot.com/settings/setup) |

## Upstream API

- **Provider**: Weglot
- **Base URL**: https://api.weglot.com
- **Auth**: API key required
- **Docs**: https://developers.weglot.com/api/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-weglot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-weglot
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
