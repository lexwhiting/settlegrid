# settlegrid-datamuse

Datamuse Word API MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-datamuse)

Find word associations, completions, and rhymes via the Datamuse API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `means_like(query)` | Find words with a similar meaning | 1¢ |
| `sounds_like(word)` | Find words that sound like the input | 1¢ |
| `spelled_like(pattern)` | Find words spelled similarly (supports wildcards) | 1¢ |

## Parameters

### means_like
- `query` (string, required) — Concept or phrase to match

### sounds_like
- `word` (string, required) — Word to match phonetically

### spelled_like
- `pattern` (string, required) — Spelling pattern (use ? for single char, * for multiple)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Datamuse
- **Base URL**: https://api.datamuse.com
- **Auth**: None required
- **Rate Limits**: 100,000 requests/day
- **Docs**: https://www.datamuse.com/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-datamuse .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-datamuse
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
