# settlegrid-reqres

ReqRes MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-reqres)

Hosted REST API for front-end testing with fake user data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `list_users()` | List users with pagination | 1¢ |
| `get_user(id)` | Get a single user by ID | 1¢ |

## Parameters

### list_users
- `page` (number, optional) — Page number (default: 1)

### get_user
- `id` (number, required) — User ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ReqRes API.

## Upstream API

- **Provider**: ReqRes
- **Base URL**: https://reqres.in/api
- **Auth**: None required
- **Docs**: https://reqres.in/

## Deploy

### Docker

```bash
docker build -t settlegrid-reqres .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-reqres
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
