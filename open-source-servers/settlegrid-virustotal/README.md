# settlegrid-virustotal

VirusTotal MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-virustotal)

Scan URLs, files, and IPs for malware and threats via the VirusTotal API.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + VIRUSTOTAL_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `scan_url(url)` | Submit a URL for scanning | 2¢ |
| `get_url_report(url)` | Get scan report for a URL | 1¢ |
| `get_ip_report(ip)` | Get report for an IP address | 1¢ |
| `get_domain_report(domain)` | Get report for a domain | 1¢ |

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `VIRUSTOTAL_API_KEY` | Yes | VirusTotal API key from [virustotal.com](https://www.virustotal.com/gui/my-apikey) |

## Upstream API

- **Provider**: VirusTotal
- **Base URL**: https://www.virustotal.com/api/v3
- **Auth**: API key (x-apikey header)
- **Docs**: https://docs.virustotal.com/reference

## Deploy

### Docker

```bash
docker build -t settlegrid-virustotal .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e VIRUSTOTAL_API_KEY=xxx -p 3000:3000 settlegrid-virustotal
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
