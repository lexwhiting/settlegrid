# settlegrid-hash

Hash Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hash)

Hash text with SHA-256, SHA-512, MD5, and more.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `hash_text(text, algorithm)` | Hash text with a specified algorithm | 1¢ |
| `hash_compare(text, hash, algorithm)` | Check if text matches a hash | 1¢ |

## Parameters

### hash_text
- `text` (string, required)
- `algorithm` (string, optional)

### hash_compare
- `text` (string, required)
- `hash` (string, required)
- `algorithm` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Local (crypto)
- **Base URL**: 
- **Auth**: None required
- **Rate Limits**: N/A (local)
- **Docs**: 

## Deploy

### Docker

```bash
docker build -t settlegrid-hash .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hash
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
