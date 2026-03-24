# settlegrid-grammar-check

Grammar Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-grammar-check)

Grammar and spell checking via LanguageTool API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_grammar(text, language?)` | Check text for grammar errors | 1¢ |

## Parameters

### check_grammar
- `text` (string, required) — Text to check
- `language` (string) — Language code (default en-US)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream LanguageTool API — it is completely free.

## Upstream API

- **Provider**: LanguageTool
- **Base URL**: https://api.languagetool.org/v2
- **Auth**: None required
- **Docs**: https://languagetool.org/http-api/

## Deploy

### Docker

```bash
docker build -t settlegrid-grammar-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-grammar-check
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
