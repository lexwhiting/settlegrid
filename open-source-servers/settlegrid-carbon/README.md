# settlegrid-carbon

Carbon MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-carbon)

Create beautiful code snippet images for sharing and documentation

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `create_image(code)` | Generate a code snippet image | 1¢ |

## Parameters

### create_image
- `code` (string, required) — Code to render
- `language` (string, optional) — Programming language (default: "auto")
- `theme` (string, optional) — Theme: dracula, monokai, night-owl (default: "dracula")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Carbon API.

## Upstream API

- **Provider**: Carbon
- **Base URL**: https://carbonara-42.herokuapp.com/api
- **Auth**: None required
- **Docs**: https://carbon.now.sh/

## Deploy

### Docker

```bash
docker build -t settlegrid-carbon .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-carbon
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
