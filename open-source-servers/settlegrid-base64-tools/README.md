# settlegrid-base64-tools

Base64 Tools MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-base64-tools)

Encode and decode Base64 strings — no external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `base64_encode(text)` | Encode text to Base64 | 1¢ |
| `base64_decode(encoded)` | Decode Base64 to text | 1¢ |

## Parameters

### base64_encode
- `text` (string, required) — Text to encode

### base64_decode
- `encoded` (string, required) — Base64 string to decode

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Node.js Buffer API — it is completely free.

## Upstream API

- **Provider**: Node.js Buffer
- **Base URL**: https://local
- **Auth**: None required
- **Docs**: https://nodejs.org/api/buffer.html

## Deploy

### Docker

```bash
docker build -t settlegrid-base64-tools .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-base64-tools
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
