# settlegrid-uk-legislation

UK Legislation MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-uk-legislation)

Search and retrieve UK legislation from legislation.gov.uk. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_legislation(query, type?, limit?)` | Search UK legislation | 1¢ |
| `get_act(type, year, number)` | Get a specific UK act | 1¢ |
| `get_recent(type?)` | Get recently enacted legislation | 1¢ |

## Parameters

### search_legislation
- `query` (string, required) — Search query
- `type` (string) — Type: ukpga, uksi, asp, nisi, etc.
- `limit` (number) — Max results (default 20)

### get_act
- `type` (string, required) — Legislation type (ukpga, uksi, asp)
- `year` (number, required) — Year of the act
- `number` (number, required) — Chapter/number of the act

### get_recent
- `type` (string) — Type: ukpga, uksi, asp

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream UK Legislation API — it is completely free.

## Upstream API

- **Provider**: UK Legislation
- **Base URL**: https://www.legislation.gov.uk
- **Auth**: None required
- **Docs**: https://www.legislation.gov.uk/developer

## Deploy

### Docker

```bash
docker build -t settlegrid-uk-legislation .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-uk-legislation
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
