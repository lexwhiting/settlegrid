# settlegrid-regulations-gov

Regulations.gov MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-regulations-gov)

US federal rulemaking documents, comments, and dockets

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + REGULATIONS_GOV_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_documents(filter[searchTerm])` | Search federal regulatory documents | 2¢ |
| `get_document(documentId)` | Get a specific regulatory document | 1¢ |

## Parameters

### search_documents
- `filter[searchTerm]` (string, required) — Search term
- `page[size]` (number, optional) — Results per page (default: 20)

### get_document
- `documentId` (string, required) — Document ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `REGULATIONS_GOV_API_KEY` | Yes | Regulations.gov API key from [https://api.data.gov/signup/](https://api.data.gov/signup/) |

## Upstream API

- **Provider**: Regulations.gov
- **Base URL**: https://api.regulations.gov/v4
- **Auth**: API key (query)
- **Docs**: https://open.gsa.gov/api/regulationsgov/

## Deploy

### Docker

```bash
docker build -t settlegrid-regulations-gov .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e REGULATIONS_GOV_API_KEY=xxx -p 3000:3000 settlegrid-regulations-gov
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
