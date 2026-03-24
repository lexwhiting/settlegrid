# settlegrid-case-law

Historical Case Law MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-case-law)

Access historical US case law via the Harvard Caselaw Access Project API. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_cases(query, jurisdiction?, limit?)` | Search historical cases | 2¢ |
| `get_case(id)` | Get a specific case by ID | 2¢ |
| `list_courts()` | List available courts | 1¢ |

## Parameters

### search_cases
- `query` (string, required) — Search query for case law
- `jurisdiction` (string) — Jurisdiction slug (e.g. ill, cal, us)
- `limit` (number) — Max results (default 20)

### get_case
- `id` (string, required) — Case ID

### list_courts

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Harvard Caselaw Access Project API — it is completely free.

## Upstream API

- **Provider**: Harvard Caselaw Access Project
- **Base URL**: https://api.case.law/v1
- **Auth**: None required
- **Docs**: https://case.law/docs/site_features/api

## Deploy

### Docker

```bash
docker build -t settlegrid-case-law .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-case-law
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
