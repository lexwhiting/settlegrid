# settlegrid-placeholder-images

Placeholder Images MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-placeholder-images)

Generate placeholder image URLs with custom dimensions and text.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_placeholder(width, height?, text?, bg_color?, text_color?)` | Generate placeholder image URL | 1¢ |

## Parameters

### get_placeholder
- `width` (number, required) — Width in pixels
- `height` (number) — Height (default same as width)
- `text` (string) — Overlay text
- `bg_color` (string) — Background color hex (no #)
- `text_color` (string) — Text color hex (no #)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Placeholder.com API — it is completely free.

## Upstream API

- **Provider**: Placeholder.com
- **Base URL**: https://via.placeholder.com
- **Auth**: None required
- **Docs**: https://placeholder.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-placeholder-images .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-placeholder-images
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
