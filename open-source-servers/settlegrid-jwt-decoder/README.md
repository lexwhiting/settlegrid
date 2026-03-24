# settlegrid-jwt-decoder

JWT Decoder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

Decode and inspect JWT tokens without verification. All local computation, no API needed.

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `decode_jwt(token)` | Decode JWT header and payload | Free |
| `inspect_jwt(token)` | Detailed inspection with expiry check | Free |
| `validate_jwt_structure(token)` | Validate JWT structure | Free |

## Parameters

### All methods
- `token` (string, required) — JWT token string

**Note**: This tool decodes JWTs without signature verification. Never use decoded data for auth decisions.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key |

## Deploy

```bash
docker build -t settlegrid-jwt-decoder .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-jwt-decoder
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
