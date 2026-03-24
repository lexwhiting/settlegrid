# settlegrid-what3words

what3words MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-what3words)

Convert between 3-word addresses and GPS coordinates

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WHAT3WORDS_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `convert_to_coords(words)` | Convert 3-word address to coordinates | 1¢ |
| `convert_to_words(coordinates)` | Convert coordinates to 3-word address | 1¢ |

## Parameters

### convert_to_coords
- `words` (string, required) — 3-word address (e.g. filled.count.soap)

### convert_to_words
- `coordinates` (string, required) — Coordinates as lat,lng

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WHAT3WORDS_API_KEY` | Yes | what3words API key from [https://developer.what3words.com/public-api](https://developer.what3words.com/public-api) |

## Upstream API

- **Provider**: what3words
- **Base URL**: https://api.what3words.com/v3
- **Auth**: API key (query)
- **Docs**: https://developer.what3words.com/public-api/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-what3words .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WHAT3WORDS_API_KEY=xxx -p 3000:3000 settlegrid-what3words
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
