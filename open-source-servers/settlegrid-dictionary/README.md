# settlegrid-dictionary

Free Dictionary MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-dictionary)

Look up word definitions, phonetics, and usage examples via the Free Dictionary API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `define(word)` | Get definitions, phonetics, and examples for a word | 1¢ |
| `define_language(word, language)` | Get definitions in a specific language (en, es, fr, de, etc.) | 1¢ |

## Parameters

### define
- `word` (string, required) — Word to define

### define_language
- `word` (string, required) — Word to define
- `language` (string, required) — Language code (en, es, fr, de, it, pt, etc.)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Free Dictionary API
- **Base URL**: https://api.dictionaryapi.dev/api/v2
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://dictionaryapi.dev/

## Deploy

### Docker

```bash
docker build -t settlegrid-dictionary .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-dictionary
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
