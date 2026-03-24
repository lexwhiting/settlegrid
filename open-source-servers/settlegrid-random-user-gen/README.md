# settlegrid-random-user-gen

Random User Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-random-user-gen)

Generate random user profiles for testing from RandomUser.me.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_users(count?, nationality?)` | Generate random user profiles | 1¢ |

## Parameters

### generate_users
- `count` (number) — Number of users (1-100)
- `nationality` (string) — Nationality code (e.g. US, GB, FR)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream RandomUser.me API — it is completely free.

## Upstream API

- **Provider**: RandomUser.me
- **Base URL**: https://randomuser.me/api
- **Auth**: None required
- **Docs**: https://randomuser.me/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-random-user-gen .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-random-user-gen
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
