# settlegrid-shields-io

Shields.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-shields-io)

Generate SVG badges for projects, builds, coverage, and more

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_badge(label, message, color)` | Create a custom SVG badge | 1¢ |
| `get_npm_version(package)` | Get npm package version badge URL | 1¢ |

## Parameters

### create_badge
- `label` (string, required) — Badge label text
- `message` (string, required) — Badge message text
- `color` (string, required) — Badge color (green, red, blue, hex)

### get_npm_version
- `package` (string, required) — npm package name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Shields.io API.

## Upstream API

- **Provider**: Shields.io
- **Base URL**: https://img.shields.io
- **Auth**: None required
- **Docs**: https://shields.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-shields-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-shields-io
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
