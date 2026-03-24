# settlegrid-hash-generator

Hash Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hash-generator)

Generate cryptographic hashes (MD5, SHA-1, SHA-256, SHA-512) from text.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_hash(text, algorithm?)` | Generate hash from text | 1¢ |
| `compare_hash(text, hash, algorithm?)` | Verify text against hash | 1¢ |

## Parameters

### generate_hash
- `text` (string, required) — Text to hash
- `algorithm` (string) — Algorithm: md5, sha1, sha256, sha512 (default sha256)

### compare_hash
- `text` (string, required) — Text to check
- `hash` (string, required) — Expected hash
- `algorithm` (string) — Algorithm used

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
docker build -t settlegrid-hash-generator .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hash-generator
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
