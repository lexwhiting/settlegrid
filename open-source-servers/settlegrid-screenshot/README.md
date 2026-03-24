# settlegrid-screenshot

Website Screenshot MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-screenshot)

Capture website screenshots and thumbnails. Uses free screenshot APIs.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `capture(url)` | Full page screenshot URL | 3¢ |
| `thumbnail(url)` | Small thumbnail URL | 2¢ |

## Parameters

### capture / thumbnail
- `url` (string, required) — Website URL to capture

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: Free screenshot services (microlink.io, thumbnail.ws)
- **Auth**: None required for free tier
- **Docs**: https://microlink.io/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-screenshot .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-screenshot
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
