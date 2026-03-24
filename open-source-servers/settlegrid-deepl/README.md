# settlegrid-deepl

DeepL MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-deepl)

Neural machine translation for 30+ languages with high accuracy

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + DEEPL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `translate(text, target_lang)` | Translate text between languages | 2¢ |
| `get_languages()` | Get supported languages | 1¢ |

## Parameters

### translate
- `text` (string, required) — Text to translate
- `target_lang` (string, required) — Target language (e.g. DE, FR, ES)
- `source_lang` (string, optional) — Source language (auto-detected if omitted)

### get_languages

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DEEPL_API_KEY` | Yes | DeepL API key from [https://www.deepl.com/pro-api](https://www.deepl.com/pro-api) |

## Upstream API

- **Provider**: DeepL
- **Base URL**: https://api-free.deepl.com/v2
- **Auth**: API key (header)
- **Docs**: https://www.deepl.com/docs-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-deepl .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e DEEPL_API_KEY=xxx -p 3000:3000 settlegrid-deepl
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
