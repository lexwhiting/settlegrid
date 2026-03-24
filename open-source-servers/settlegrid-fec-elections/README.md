# settlegrid-fec-elections

FEC Campaign Finance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fec-elections)

US federal election campaign finance data from the FEC.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FEC_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_candidates(name, office)` | Search for federal election candidates | 2¢ |
| `get_candidate_totals(candidate_id)` | Get financial totals for a candidate | 2¢ |

## Parameters

### search_candidates
- `name` (string, required)
- `office` (string, optional)

### get_candidate_totals
- `candidate_id` (string, required)

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FEC_API_KEY` | Yes | Free key from api.open.fec.gov/developers |


## Upstream API

- **Provider**: Federal Election Commission
- **Base URL**: https://api.open.fec.gov
- **Auth**: Free API key required
- **Rate Limits**: 1000 req/hr (free key)
- **Docs**: https://api.open.fec.gov/developers

## Deploy

### Docker

```bash
docker build -t settlegrid-fec-elections .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FEC_API_KEY=xxx -p 3000:3000 settlegrid-fec-elections
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
