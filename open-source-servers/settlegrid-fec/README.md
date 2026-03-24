# settlegrid-fec

FEC Campaign Finance MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-fec)

US Federal Election Commission campaign finance and candidate data

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + FEC_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_candidates(name)` | Search for political candidates | 1¢ |
| `get_totals(candidate_id)` | Get campaign finance totals by candidate ID | 2¢ |

## Parameters

### search_candidates
- `name` (string, required) — Candidate name
- `office` (string, optional) — Office: H(ouse), S(enate), P(resident)

### get_totals
- `candidate_id` (string, required) — FEC candidate ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `FEC_API_KEY` | No | FEC Campaign Finance API key from [https://api.open.fec.gov/developers/](https://api.open.fec.gov/developers/) |

## Upstream API

- **Provider**: FEC Campaign Finance
- **Base URL**: https://api.open.fec.gov/v1
- **Auth**: API key (query)
- **Docs**: https://api.open.fec.gov/developers/

## Deploy

### Docker

```bash
docker build -t settlegrid-fec .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e FEC_API_KEY=xxx -p 3000:3000 settlegrid-fec
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
