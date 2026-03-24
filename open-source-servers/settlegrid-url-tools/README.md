# settlegrid-url-tools

URL Tools MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-url-tools)

URL encode/decode, parse, and validate — local processing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse_url(url)` | Parse and analyze a URL | 1¢ |
| `encode_url(text)` | URL encode a string | 1¢ |

## Parameters

### parse_url
- `url` (string, required) — URL to parse

### encode_url
- `text` (string, required) — Text to encode

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Local Processing API — it is completely free.

## Upstream API

- **Provider**: Local Processing
- **Base URL**: https://local
- **Auth**: None required
- **Docs**: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/URL

## Deploy

### Docker

```bash
docker build -t settlegrid-url-tools .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-url-tools
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
