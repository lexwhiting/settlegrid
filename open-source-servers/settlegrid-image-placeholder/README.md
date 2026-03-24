# settlegrid-image-placeholder

Image Placeholder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Generate placeholder image URLs for design and prototyping. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_placeholder(width, height?, options?)` | Placeholder image URL | Free |
| `get_avatar(name, size?)` | Avatar placeholder | Free |
| `get_pattern(width, height?, pattern?)` | Pattern/photo placeholder | Free |

## Parameters

### get_placeholder
- `width` (number, required) — Width in pixels
- `height` (number) — Height in pixels (default: same as width)
- `bgColor` (string) — Background color hex
- `textColor` (string) — Text color hex
- `text` (string) — Custom text overlay

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-image-placeholder .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-image-placeholder
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
