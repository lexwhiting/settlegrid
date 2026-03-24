# settlegrid-bundlephobia

Bundlephobia MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-bundlephobia)

Check npm package bundle sizes and track size history. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_bundle_size(package, version?)` | Bundle size for a package | 1¢ |
| `get_bundle_history(package)` | Size history across versions | 2¢ |

## Parameters

### get_bundle_size
- `package` (string, required) — npm package name
- `version` (string) — Specific version

### get_bundle_history
- `package` (string, required) — npm package name

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No additional API keys needed.

## Upstream API

- **Provider**: Bundlephobia
- **Base URL**: https://bundlephobia.com/api
- **Auth**: None required

## Deploy

### Docker

```bash
docker build -t settlegrid-bundlephobia .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-bundlephobia
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
