# settlegrid-httpbin

HTTPBin MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-httpbin)

HTTP request and response testing service

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_ip()` | Get your origin IP address | 1¢ |
| `get_headers()` | Get request headers | 1¢ |
| `get_user_agent()` | Get user agent string | 1¢ |

## Parameters

### get_ip

### get_headers

### get_user_agent

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream HTTPBin API.

## Upstream API

- **Provider**: HTTPBin
- **Base URL**: https://httpbin.org
- **Auth**: None required
- **Docs**: https://httpbin.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-httpbin .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-httpbin
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
