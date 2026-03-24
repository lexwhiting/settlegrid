# settlegrid-npm-registry

npm Registry MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-npm-registry)

npm package metadata, download counts, and search

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_package(name)` | Get package metadata | 1¢ |
| `search(text)` | Search npm packages | 1¢ |

## Parameters

### get_package
- `name` (string, required) — Package name (e.g. react, express)

### search
- `text` (string, required) — Search query
- `size` (number, optional) — Results count (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream npm Registry API.

## Upstream API

- **Provider**: npm Registry
- **Base URL**: https://registry.npmjs.org
- **Auth**: None required
- **Docs**: https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md

## Deploy

### Docker

```bash
docker build -t settlegrid-npm-registry .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-npm-registry
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
