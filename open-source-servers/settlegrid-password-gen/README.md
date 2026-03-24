# settlegrid-password-gen

Password Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-password-gen)

Generate secure random passwords — local processing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_password(length?, uppercase?, numbers?, symbols?)` | Generate a secure password | 1¢ |

## Parameters

### generate_password
- `length` (number) — Password length (8-128, default 16)
- `uppercase` (boolean) — Include uppercase (default true)
- `numbers` (boolean) — Include numbers (default true)
- `symbols` (boolean) — Include symbols (default true)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Node.js Crypto API — it is completely free.

## Upstream API

- **Provider**: Node.js Crypto
- **Base URL**: https://local
- **Auth**: None required
- **Docs**: https://nodejs.org/api/crypto.html

## Deploy

### Docker

```bash
docker build -t settlegrid-password-gen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-password-gen
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
