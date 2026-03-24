# settlegrid-sherpa-romeo

SHERPA/RoMEO Journal Policies MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-sherpa-romeo)

Look up journal self-archiving policies, publisher permissions, and open access mandates via SHERPA/RoMEO.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_policy(issn)` | Get journal policy by ISSN | 1¢ |
| `search_journals(query)` | Search journals | 1¢ |
| `list_publishers(limit?)` | List publishers | 1¢ |

## Parameters

### get_policy
- `issn` (string, required) — Journal ISSN (e.g. 0028-0836)

### search_journals
- `query` (string, required) — Journal title to search

### list_publishers
- `limit` (number) — Max results (default: 20, max: 50)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream SHERPA/RoMEO API — it is completely free.

## Upstream API

- **Provider**: SHERPA/RoMEO
- **Base URL**: https://v2.sherpa.ac.uk/cgi/retrieve
- **Auth**: None required
- **Docs**: https://v2.sherpa.ac.uk/api/

## Deploy

### Docker

```bash
docker build -t settlegrid-sherpa-romeo .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-sherpa-romeo
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
