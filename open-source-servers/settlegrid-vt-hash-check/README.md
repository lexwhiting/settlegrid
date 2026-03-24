# settlegrid-vt-hash-check

VirusTotal Hash Check MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-vt-hash-check)

Check file hashes against VirusTotal malware database.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `check_file_hash(hash)` | Check file hash against VirusTotal | 3¢ |

## Parameters

### check_file_hash
- `hash` (string, required) — File hash (MD5, SHA1, or SHA256)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `VIRUSTOTAL_API_KEY` | Yes | VirusTotal API key from [https://www.virustotal.com/](https://www.virustotal.com/) |

## Upstream API

- **Provider**: VirusTotal
- **Base URL**: https://www.virustotal.com/api/v3
- **Auth**: API key required
- **Docs**: https://docs.virustotal.com/reference/overview

## Deploy

### Docker

```bash
docker build -t settlegrid-vt-hash-check .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-vt-hash-check
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
