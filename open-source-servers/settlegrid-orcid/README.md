# settlegrid-orcid

ORCID Researcher Profiles MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-orcid)

Search and retrieve researcher profiles, works, and affiliations from the ORCID registry. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_researchers(query, limit?)` | Search for researchers | 1¢ |
| `get_profile(orcid)` | Get researcher profile | 1¢ |
| `get_works(orcid, limit?)` | Get works by a researcher | 2¢ |

## Parameters

### search_researchers
- `query` (string, required) — Name or keyword to search
- `limit` (number) — Max results (default: 10, max: 50)

### get_profile
- `orcid` (string, required) — ORCID iD (e.g. 0000-0002-1825-0097)

### get_works
- `orcid` (string, required) — ORCID iD
- `limit` (number) — Max works to return (default: 20, max: 200)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream ORCID API — it is completely free.

## Upstream API

- **Provider**: ORCID
- **Base URL**: https://pub.orcid.org/v3.0
- **Auth**: None required
- **Docs**: https://info.orcid.org/documentation/api-tutorials/

## Deploy

### Docker

```bash
docker build -t settlegrid-orcid .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-orcid
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
