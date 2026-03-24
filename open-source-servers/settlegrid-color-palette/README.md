# settlegrid-color-palette

Color Palette MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-color-palette)

Color conversion, palette generation, and color info from TheColorAPI.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_color_info(hex)` | Get info for a color | 1¢ |
| `get_color_scheme(hex, mode?, count?)` | Generate a color scheme | 1¢ |

## Parameters

### get_color_info
- `hex` (string, required) — Hex color code (e.g. FF5733)

### get_color_scheme
- `hex` (string, required) — Base hex color
- `mode` (string) — Mode: analogic, complement, triad, quad (default complement)
- `count` (number) — Number of colors (default 5)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream TheColorAPI API — it is completely free.

## Upstream API

- **Provider**: TheColorAPI
- **Base URL**: https://www.thecolorapi.com
- **Auth**: None required
- **Docs**: https://www.thecolorapi.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-color-palette .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-color-palette
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
