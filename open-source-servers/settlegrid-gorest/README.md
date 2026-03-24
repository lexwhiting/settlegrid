# settlegrid-gorest

GoRest MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-gorest)

Fake REST API for testing with users, posts, comments, and todos

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + GOREST_TOKEN
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_users()` | Get list of users | 1¢ |
| `get_posts()` | Get list of posts | 1¢ |

## Parameters

### get_users
- `page` (number, optional) — Page number (default: 1)

### get_posts
- `page` (number, optional) — Page number (default: 1)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `GOREST_TOKEN` | Yes | GoRest API key from [https://gorest.co.in/consumer/login](https://gorest.co.in/consumer/login) |

## Upstream API

- **Provider**: GoRest
- **Base URL**: https://gorest.co.in/public/v2
- **Auth**: API key (bearer)
- **Docs**: https://gorest.co.in/

## Deploy

### Docker

```bash
docker build -t settlegrid-gorest .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e GOREST_TOKEN=xxx -p 3000:3000 settlegrid-gorest
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
