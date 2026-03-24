# settlegrid-jsonplaceholder

JSONPlaceholder MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-jsonplaceholder)

Fake REST API for testing with posts, comments, users, and todos

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_posts()` | Get sample blog posts | 1¢ |
| `get_users()` | Get sample user data | 1¢ |
| `get_todos()` | Get sample todo items | 1¢ |

## Parameters

### get_posts
- `userId` (number, optional) — Filter by user ID

### get_users

### get_todos
- `userId` (number, optional) — Filter by user ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream JSONPlaceholder API.

## Upstream API

- **Provider**: JSONPlaceholder
- **Base URL**: https://jsonplaceholder.typicode.com
- **Auth**: None required
- **Docs**: https://jsonplaceholder.typicode.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-jsonplaceholder .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-jsonplaceholder
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
