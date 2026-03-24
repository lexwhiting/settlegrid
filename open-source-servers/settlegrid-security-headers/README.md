# settlegrid-security-headers

Security Headers MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-security-headers)

Analyze HTTP security headers of any website.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `scan_headers(url)` | Analyze security headers of a URL | 1¢ |
| `check_csp(url)` | Check Content-Security-Policy header of a URL | 1¢ |

## Parameters

### scan_headers
- `url` (string, required)

### check_csp
- `url` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: SecurityHeaders.com
- **Base URL**: https://securityheaders.com
- **Auth**: None required
- **Rate Limits**: Fair use (no key)
- **Docs**: https://securityheaders.com

## Deploy

### Docker

```bash
docker build -t settlegrid-security-headers .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-security-headers
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
