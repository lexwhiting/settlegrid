# settlegrid-remove-bg

Remove.bg MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-remove-bg)

Remove image backgrounds automatically via Remove.bg API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + REMOVE_BG_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `remove_background(image_url, size)` | Remove background from an image URL | 3¢ |
| `remove_bg_with_color(image_url, bg_color)` | Remove background and replace with a solid color | 3¢ |

## Parameters

### remove_background
- `image_url` (string, required)
- `size` (string, optional)

### remove_bg_with_color
- `image_url` (string, required)
- `bg_color` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `REMOVE_BG_API_KEY` | Yes | Free key from remove.bg/api |


## Upstream API

- **Provider**: Remove.bg
- **Base URL**: https://www.remove.bg
- **Auth**: Free API key required
- **Rate Limits**: 50 calls/month (free)
- **Docs**: https://www.remove.bg/api

## Deploy

### Docker

```bash
docker build -t settlegrid-remove-bg .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e REMOVE_BG_API_KEY=xxx -p 3000:3000 settlegrid-remove-bg
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
