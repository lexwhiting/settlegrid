# settlegrid-repec

RePEc Economics Papers MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-repec)

Search economics research papers, journals, and working papers via OpenAlex proxy. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_papers(query, limit?)` | Search economics papers | 1¢ |
| `get_paper(id)` | Get paper by OpenAlex ID | 1¢ |
| `list_journals(limit?)` | List economics journals | 1¢ |

## Parameters

### search_papers
- `query` (string, required) — Search query for economics papers
- `limit` (number) — Max results (default: 10, max: 50)

### get_paper
- `id` (string, required) — OpenAlex work ID or DOI

### list_journals
- `limit` (number) — Max results (default: 20, max: 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenAlex API — it is completely free.

## Upstream API

- **Provider**: OpenAlex
- **Base URL**: https://api.openalex.org/works
- **Auth**: None required
- **Docs**: https://docs.openalex.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-repec .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-repec
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
