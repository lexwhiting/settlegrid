# settlegrid-stack-exchange

Stack Exchange MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-stack-exchange)

Stack Overflow and Stack Exchange questions, answers, and users

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search(q)` | Search questions across Stack Exchange sites | 1¢ |
| `get_answers(id)` | Get answers for a question by ID | 1¢ |

## Parameters

### search
- `q` (string, required) — Search query
- `site` (string, optional) — Site name (e.g. stackoverflow) (default: "stackoverflow")
- `pagesize` (number, optional) — Results per page (default: 20)

### get_answers
- `id` (number, required) — Question ID
- `site` (string, optional) — Site name (default: "stackoverflow")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Stack Exchange API.

## Upstream API

- **Provider**: Stack Exchange
- **Base URL**: https://api.stackexchange.com/2.3
- **Auth**: None required
- **Docs**: https://api.stackexchange.com/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-stack-exchange .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-stack-exchange
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
