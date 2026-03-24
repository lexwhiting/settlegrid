# settlegrid-urban-dictionary

Urban Dictionary MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-urban-dictionary)

Look up slang definitions and trending words via the Urban Dictionary API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `define(term)` | Look up a slang term on Urban Dictionary | 1¢ |
| `random()` | Get random slang definitions | 1¢ |

## Parameters

### define
- `term` (string, required) — Slang term to look up

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Urban Dictionary
- **Base URL**: https://api.urbandictionary.com/v0
- **Auth**: None required
- **Rate Limits**: No published limit
- **Docs**: https://api.urbandictionary.com

## Deploy

### Docker

```bash
docker build -t settlegrid-urban-dictionary .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-urban-dictionary
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
