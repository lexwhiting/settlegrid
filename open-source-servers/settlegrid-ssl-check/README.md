# settlegrid-ssl-check

SSL Certificate Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ssl-check)

SSL/TLS certificate analysis and grading via Qualys SSL Labs API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `analyze(host)` | Start SSL analysis for a host | 2¢ |
| `get_status(host)` | Get SSL analysis status and results | 1¢ |
| `get_endpoint(host, ip)` | Get detailed endpoint SSL info | 2¢ |

## Parameters

### analyze
- `host` (string, required) — Hostname to analyze (e.g. example.com)

### get_status
- `host` (string, required) — Hostname to check

### get_endpoint
- `host` (string, required) — Hostname
- `ip` (string, required) — Endpoint IP address

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SSL Labs API — it is completely free.

## Upstream API

- **Provider**: SSL Labs
- **Base URL**: https://api.ssllabs.com/api/v3
- **Auth**: None required
- **Docs**: https://github.com/ssllabs/ssllabs-scan/blob/master/ssllabs-api-docs-v3.md

## Deploy

### Docker

```bash
docker build -t settlegrid-ssl-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ssl-check
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
