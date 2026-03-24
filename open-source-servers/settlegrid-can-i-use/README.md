# settlegrid-can-i-use

Can I Use MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-can-i-use)

Browser compatibility data for web technologies and APIs

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_feature(feature)` | Get browser compatibility for a feature | 1¢ |

## Parameters

### get_feature
- `feature` (string, required) — Feature name (e.g. css-grid, flexbox, webgl)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Can I Use API.

## Upstream API

- **Provider**: Can I Use
- **Base URL**: https://raw.githubusercontent.com/nicedoc/browserl/main
- **Auth**: None required
- **Docs**: https://caniuse.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-can-i-use .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-can-i-use
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
