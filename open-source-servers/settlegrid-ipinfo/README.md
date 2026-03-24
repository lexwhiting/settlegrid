# settlegrid-ipinfo

IPinfo MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-ipinfo)

Look up IP address geolocation and network data from IPinfo with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + IPINFO_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `lookup_ip(ip)` | Get geolocation data for an IP | 1¢ |
| `get_my_ip()` | Get geolocation for current IP | 1¢ |

## Parameters

### lookup_ip
- `ip` (string, required) — IP address (IPv4 or IPv6)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `IPINFO_TOKEN` | Yes | IPinfo bearer token (optional for basic) |


## Upstream API

- **Provider**: IPinfo
- **Base URL**: https://ipinfo.io
- **Auth**: Free tier (50k/month)
- **Rate Limits**: 50,000 req/month
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
