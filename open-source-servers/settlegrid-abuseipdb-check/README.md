# settlegrid-abuseipdb-check

AbuseIPDB Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-abuseipdb-check)

Check IP addresses against AbuseIPDB threat intelligence database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_ip_abuse(ip)` | Check IP for abuse reports | 2¢ |
| `get_blacklist(confidence_min?)` | Get AbuseIPDB blacklist | 3¢ |

## Parameters

### check_ip_abuse
- `ip` (string, required) — IP address to check

### get_blacklist
- `confidence_min` (number) — Min confidence score (default 90)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `ABUSEIPDB_API_KEY` | Yes | AbuseIPDB API key from [https://www.abuseipdb.com/account/api](https://www.abuseipdb.com/account/api) |

## Upstream API

- **Provider**: AbuseIPDB
- **Base URL**: https://api.abuseipdb.com/api/v2
- **Auth**: API key required
- **Docs**: https://docs.abuseipdb.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-abuseipdb-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-abuseipdb-check
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
