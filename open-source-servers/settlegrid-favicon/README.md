# settlegrid-favicon

Favicon Extractor MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Extract favicon URLs from any website using multiple providers. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_favicon(domain, size?)` | Get favicon URLs for a domain | 1¢ |
| `get_favicons_bulk(domains)` | Bulk favicon extraction | 2¢ |

## Parameters

### get_favicon
- `domain` (string, required) — Domain name (e.g., github.com)
- `size` (number) — Preferred size in pixels (default 64)

### get_favicons_bulk
- `domains` (string[], required) — Array of domains (max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-favicon .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-favicon
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
