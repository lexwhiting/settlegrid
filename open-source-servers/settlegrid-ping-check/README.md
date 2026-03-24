# settlegrid-ping-check

Ping & Uptime Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ping-check)

Ping hosts, run traceroutes, and check HTTP availability via HackerTarget.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `ping(host)` | Ping a host and get latency stats | 1¢ |
| `traceroute(host)` | Run a traceroute to a host | 2¢ |
| `check_http(url)` | Check HTTP availability of a URL | 1¢ |

## Parameters

### ping
- `host` (string, required) — Hostname or IP address to ping

### traceroute
- `host` (string, required) — Hostname or IP address

### check_http
- `url` (string, required) — URL to check (e.g. https://example.com)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream HackerTarget API — it is completely free.

## Upstream API

- **Provider**: HackerTarget
- **Base URL**: https://api.hackertarget.com
- **Auth**: None required
- **Docs**: https://hackertarget.com/ip-tools/

## Deploy

### Docker

```bash
docker build -t settlegrid-ping-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-ping-check
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
