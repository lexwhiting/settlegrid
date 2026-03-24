# settlegrid-free-dictionary

Free Dictionary MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-free-dictionary)

English dictionary definitions, phonetics, and examples from Free Dictionary API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `define_word(word)` | Get word definition | 1¢ |

## Parameters

### define_word
- `word` (string, required) — English word to define

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Free Dictionary API API — it is completely free.

## Upstream API

- **Provider**: Free Dictionary API
- **Base URL**: https://api.dictionaryapi.dev/api/v2
- **Auth**: None required
- **Docs**: https://dictionaryapi.dev/

## Deploy

### Docker

```bash
docker build -t settlegrid-free-dictionary .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-free-dictionary
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
