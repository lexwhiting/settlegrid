# settlegrid-stack-exchange

Stack Exchange MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-stack-exchange)

Search Stack Overflow questions and answers via the Stack Exchange API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_questions(query, tagged, pagesize)` | Search Stack Overflow questions | 1¢ |
| `get_answers(question_id)` | Get answers for a question | 1¢ |

## Parameters

### search_questions
- `query` (string, required) — Search query
- `tagged` (string, optional) — Tag filter (semicolon-separated)
- `pagesize` (number, optional) — Results (1-20, default 10)

### get_answers
- `question_id` (number, required) — Question ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Stack Exchange
- **Base URL**: https://api.stackexchange.com/2.3
- **Auth**: None required
- **Rate Limits**: 300 req/day without key
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
