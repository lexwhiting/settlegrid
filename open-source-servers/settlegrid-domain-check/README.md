# settlegrid-domain-check

Domain Checker MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-domain-check)

Check domain name availability via WhoisXML API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + WHOISXML_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check(domain)` | Check if a domain name is available | 2¢ |
| `check_bulk(domains)` | Check multiple domains (comma-separated) | 2¢ |

## Parameters

### check
- `domain` (string, required)

### check_bulk
- `domains` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `WHOISXML_API_KEY` | Yes | Free key from whoisxmlapi.com |


## Upstream API

- **Provider**: WhoisXML API
- **Base URL**: https://domain-availability.whoisxmlapi.com/api/v1
- **Auth**: Free API key required
- **Rate Limits**: 500 req/month (free)
- **Docs**: https://domain-availability.whoisxmlapi.com/api/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-domain-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e WHOISXML_API_KEY=xxx -p 3000:3000 settlegrid-domain-check
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
