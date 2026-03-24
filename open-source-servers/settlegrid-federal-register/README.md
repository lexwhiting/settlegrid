# settlegrid-federal-register

Federal Register MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-federal-register)

Search and retrieve Federal Register documents, rules, and notices. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_documents(query, type?, limit?)` | Search Federal Register documents | 1¢ |
| `get_document(number)` | Get a specific document | 1¢ |
| `get_recent(agency?)` | Get recent documents | 1¢ |

## Parameters

### search_documents
- `query` (string, required) — Search query
- `type` (string) — Document type: rule, proposed_rule, notice, presidential_document
- `limit` (number) — Max results (default 20)

### get_document
- `number` (string, required) — Federal Register document number

### get_recent
- `agency` (string) — Filter by agency slug

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Federal Register API — it is completely free.

## Upstream API

- **Provider**: Federal Register
- **Base URL**: https://www.federalregister.gov/api/v1
- **Auth**: None required
- **Docs**: https://www.federalregister.gov/developers/documentation/api/v1

## Deploy

### Docker

```bash
docker build -t settlegrid-federal-register .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-federal-register
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
