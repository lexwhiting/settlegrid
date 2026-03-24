# settlegrid-color-api

Color Palettes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-color-api)

Look up color details, generate color schemes, and explore palettes via The Color API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_color(hex)` | Get color details by hex | 1¢ |
| `get_scheme(hex, mode?, count?)` | Generate color scheme | 1¢ |
| `get_random()` | Get a random color | 1¢ |

## Parameters

### get_color
- `hex` (string, required) — Hex color code (e.g. FF5733)

### get_scheme
- `hex` (string, required) — Base hex color (e.g. 0047AB)
- `mode` (string) — Scheme mode: monochrome, analogic, complement, triad, quad
- `count` (number) — Number of colors (default 5)

### get_random

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream The Color API API — it is completely free.

## Upstream API

- **Provider**: The Color API
- **Base URL**: https://www.thecolorapi.com
- **Auth**: None required
- **Docs**: https://www.thecolorapi.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-color-api .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-color-api
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
