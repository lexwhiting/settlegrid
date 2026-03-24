# settlegrid-language-detect

Language Detection MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-language-detect)

Detect the language of text using ws.detectlanguage.com free API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `detect_language(text)` | Detect language of text | 2¢ |

## Parameters

### detect_language
- `text` (string, required) — Text to analyze

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `DETECTLANGUAGE_API_KEY` | Yes | DetectLanguage API key from [https://detectlanguage.com/](https://detectlanguage.com/) |

## Upstream API

- **Provider**: DetectLanguage
- **Base URL**: https://ws.detectlanguage.com/0.2
- **Auth**: API key required
- **Docs**: https://detectlanguage.com/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-language-detect .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-language-detect
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
