# settlegrid-eu-legislation

EU Legislation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-eu-legislation)

Search and retrieve EU legislation from EUR-Lex. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_legislation(query, type?, limit?)` | Search EU legislation | 2¢ |
| `get_document(celex)` | Get a document by CELEX number | 2¢ |
| `get_recent(type?)` | Get recent EU legislation | 1¢ |

## Parameters

### search_legislation
- `query` (string, required) — Search query
- `type` (string) — Document type: regulation, directive, decision
- `limit` (number) — Max results (default 20)

### get_document
- `celex` (string, required) — CELEX document identifier

### get_recent
- `type` (string) — Document type: regulation, directive, decision

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream EUR-Lex API — it is completely free.

## Upstream API

- **Provider**: EUR-Lex
- **Base URL**: https://eur-lex.europa.eu
- **Auth**: None required
- **Docs**: https://eur-lex.europa.eu/content/tools/webservices/SearchWebServiceUserManual_v2.00.pdf

## Deploy

### Docker

```bash
docker build -t settlegrid-eu-legislation .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-eu-legislation
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
