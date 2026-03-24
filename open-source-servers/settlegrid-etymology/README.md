# settlegrid-etymology

Word Origin & Definition Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-etymology)

Access word definitions, etymology, and phonetics via the Free Dictionary API. Look up definitions, origins, and pronunciations.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_definition(word, lang?)` | Get word definitions | 1¢ |
| `get_etymology(word)` | Get word origin/etymology | 2¢ |
| `get_phonetics(word)` | Get word phonetics/pronunciation | 1¢ |

## Parameters

### get_definition
- `word` (string, required) — Word to look up (e.g. "serendipity")
- `lang` (string) — Language code (default "en")

### get_etymology
- `word` (string, required) — Word to look up

### get_phonetics
- `word` (string, required) — Word to look up

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Free Dictionary API API — it is completely free.

## Upstream API

- **Provider**: Free Dictionary API
- **Base URL**: https://api.dictionaryapi.dev/api/v2/entries
- **Auth**: None required
- **Docs**: https://dictionaryapi.dev/

## Deploy

### Docker

```bash
docker build -t settlegrid-etymology .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-etymology
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
