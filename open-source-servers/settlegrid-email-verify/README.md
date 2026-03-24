# settlegrid-email-verify

Email Verification MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-email-verify)

Verify email addresses using format validation and DNS MX record checks.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `verify(email)` | Full email verification | 2¢ |
| `verify_batch(emails[])` | Batch email verification | 1¢/email |

## Parameters

### verify
- `email` (string, required) — Email address to verify

### verify_batch
- `emails` (string[], required) — Array of email addresses (max 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Upstream API

- **Provider**: DNS-based + emailrep.io
- **Auth**: None required for basic checks
- **Docs**: https://emailrep.io/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-email-verify .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-email-verify
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
