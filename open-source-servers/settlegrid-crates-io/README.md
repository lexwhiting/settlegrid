# settlegrid-crates-io

crates.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-crates-io)

Rust package metadata, downloads, and search from the crates.io registry

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_crate(name)` | Get Rust crate information | 1¢ |
| `search(q)` | Search Rust crates | 1¢ |

## Parameters

### get_crate
- `name` (string, required) — Crate name (e.g. serde, tokio)

### search
- `q` (string, required) — Search query
- `per_page` (number, optional) — Results per page (default: 20)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream crates.io API.

## Upstream API

- **Provider**: crates.io
- **Base URL**: https://crates.io/api/v1
- **Auth**: None required
- **Docs**: https://crates.io/

## Deploy

### Docker

```bash
docker build -t settlegrid-crates-io .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-crates-io
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
