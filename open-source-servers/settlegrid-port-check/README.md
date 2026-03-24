# settlegrid-port-check

Port Availability Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-port-check)

Check open ports, scan common ports, and retrieve HTTP headers via HackerTarget.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_port(host, port)` | Check if a specific port is open on a host | 1¢ |
| `scan_common(host)` | Scan common ports on a host | 2¢ |
| `get_headers(url)` | Retrieve HTTP headers from a URL | 1¢ |

## Parameters

### check_port
- `host` (string, required) — Hostname or IP address
- `port` (number, required) — Port number (1-65535)

### scan_common
- `host` (string, required) — Hostname or IP address to scan

### get_headers
- `url` (string, required) — URL to check headers for

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
docker build -t settlegrid-port-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-port-check
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
