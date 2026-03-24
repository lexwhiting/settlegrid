# settlegrid-mymemory-translate

MyMemory Translation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-mymemory-translate)

Free text translation via MyMemory Translation API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `translate_text(text, from, to)` | Translate text between languages | 1¢ |

## Parameters

### translate_text
- `text` (string, required) — Text to translate
- `from` (string, required) — Source language code (e.g. en)
- `to` (string, required) — Target language code (e.g. es)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream MyMemory API — it is completely free.

## Upstream API

- **Provider**: MyMemory
- **Base URL**: https://api.mymemory.translated.net
- **Auth**: None required
- **Docs**: https://mymemory.translated.net/doc/spec.php

## Deploy

### Docker

```bash
docker build -t settlegrid-mymemory-translate .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-mymemory-translate
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
