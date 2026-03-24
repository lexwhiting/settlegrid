# settlegrid-placeholder

Placeholder Images MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-placeholder)

Generate placeholder images via placehold.co.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_image(width, height, text, bg, color)` | Get a placeholder image URL | 1¢ |
| `get_svg(width, height, text)` | Get a placeholder SVG URL | 1¢ |

## Parameters

### get_image
- `width` (number, required)
- `height` (number, required)
- `text` (string, optional)
- `bg` (string, optional)
- `color` (string, optional)

### get_svg
- `width` (number, required)
- `height` (number, required)
- `text` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: placehold.co
- **Base URL**: https://placehold.co
- **Auth**: None required
- **Rate Limits**: Unlimited
- **Docs**: https://placehold.co/

## Deploy

### Docker

```bash
docker build -t settlegrid-placeholder .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-placeholder
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
