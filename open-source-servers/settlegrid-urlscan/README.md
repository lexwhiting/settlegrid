# settlegrid-urlscan

urlscan.io MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-urlscan)

Scan and analyze URLs for security threats via the urlscan.io API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + URLSCAN_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `submit_scan(url)` | Submit a URL for scanning | 2¢ |
| `get_result(uuid)` | Get scan result by UUID | 1¢ |
| `search_scans(query)` | Search existing scans | 1¢ |
| `get_screenshot(uuid)` | Get screenshot URL from scan | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `URLSCAN_API_KEY` | Yes | urlscan.io API key from [urlscan.io](https://urlscan.io/user/signup) |

## Upstream API

- **Provider**: urlscan.io
- **Base URL**: https://urlscan.io/api/v1
- **Auth**: API key (header)
- **Docs**: https://urlscan.io/docs/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-urlscan .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e URLSCAN_API_KEY=xxx -p 3000:3000 settlegrid-urlscan
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) --- The Settlement Layer for the AI Economy
