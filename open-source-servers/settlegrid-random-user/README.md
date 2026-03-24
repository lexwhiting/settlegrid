# settlegrid-random-user

Random User Generator MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-random-user)

Generate random user profiles for testing and development.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `generate_users(count, nationality)` | Generate random user profiles | 1¢ |
| `generate_user(nationality)` | Generate a single random user with full details | 1¢ |

## Parameters

### generate_users
- `count` (number, optional)
- `nationality` (string, optional)

### generate_user
- `nationality` (string, optional)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: RandomUser.me
- **Base URL**: https://randomuser.me
- **Auth**: None required
- **Rate Limits**: Unlimited (no key)
- **Docs**: https://randomuser.me/documentation

## Deploy

### Docker

```bash
docker build -t settlegrid-random-user .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-random-user
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
