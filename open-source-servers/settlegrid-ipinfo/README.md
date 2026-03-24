# settlegrid-ipinfo

ipinfo MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ipinfo)

IP address geolocation, ASN, company, and privacy detection

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + IPINFO_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup(ip)` | Get geolocation data for an IP | 1¢ |
| `get_my_ip()` | Get your own IP info | 1¢ |

## Parameters

### lookup
- `ip` (string, required) — IP address to lookup

### get_my_ip

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IPINFO_TOKEN` | Yes | ipinfo API key from [https://ipinfo.io/signup](https://ipinfo.io/signup) |

## Upstream API

- **Provider**: ipinfo
- **Base URL**: https://ipinfo.io
- **Auth**: API key (bearer)
- **Docs**: https://ipinfo.io/developers

## Deploy

### Docker

```bash
docker build -t settlegrid-ipinfo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e IPINFO_TOKEN=xxx -p 3000:3000 settlegrid-ipinfo
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
