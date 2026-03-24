# settlegrid-phishtank

PhishTank MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-phishtank)

Check URLs against the PhishTank phishing database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + PHISHTANK_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_url(url)` | Check if URL is a known phish | 1¢ |
| `get_phish(phish_id)` | Get details of a phish report | 1¢ |
| `get_recent(limit)` | Get recent phishing submissions | 2¢ |
| `check_status()` | Get PhishTank database status | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |
| `PHISHTANK_API_KEY` | Yes | PhishTank API key from [phishtank.org](https://phishtank.org/api_register.php) |

## Upstream API

- **Provider**: PhishTank
- **Base URL**: https://checkurl.phishtank.com
- **Auth**: API key (post body)
- **Docs**: https://phishtank.org/api_info.php

## Deploy

### Docker

```bash
docker build -t settlegrid-phishtank .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e PHISHTANK_API_KEY=xxx -p 3000:3000 settlegrid-phishtank
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
