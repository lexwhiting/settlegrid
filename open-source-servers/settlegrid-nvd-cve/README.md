# settlegrid-nvd-cve

NIST NVD CVE MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-nvd-cve)

CVE vulnerability data from NIST National Vulnerability Database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cve(keyword, limit?)` | Search CVEs by keyword | 2¢ |
| `get_cve(cve_id)` | Get CVE details by ID | 2¢ |

## Parameters

### search_cve
- `keyword` (string, required) — Search keyword
- `limit` (number) — Max results (default 10)

### get_cve
- `cve_id` (string, required) — CVE ID (e.g. CVE-2024-1234)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NIST NVD API — it is completely free.

## Upstream API

- **Provider**: NIST NVD
- **Base URL**: https://services.nvd.nist.gov/rest/json/cves/2.0
- **Auth**: None required
- **Docs**: https://nvd.nist.gov/developers/vulnerabilities

## Deploy

### Docker

```bash
docker build -t settlegrid-nvd-cve .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-nvd-cve
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
