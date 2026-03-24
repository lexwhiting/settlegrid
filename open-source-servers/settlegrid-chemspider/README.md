# settlegrid-chemspider

ChemSpider MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-chemspider)

Search chemical compounds and molecular data via ChemSpider/RSC with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key + CHEMSPIDER_API_KEY
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_compounds(query)` | Search compounds by name or formula | 2¢ |
| `get_compound(csid)` | Get compound details by ChemSpider ID | 2¢ |

## Parameters

### search_compounds
- `query` (string, required) — Compound name or formula

### get_compound
- `csid` (number, required) — ChemSpider compound ID

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |
| `CHEMSPIDER_API_KEY` | Yes | ChemSpider / RSC API key |


## Upstream API

- **Provider**: Royal Society of Chemistry
- **Base URL**: https://api.rsc.org/compounds/v1
- **Auth**: Free API key required
- **Rate Limits**: 15 req/min
- **Docs**: https://developer.rsc.org/compounds-v1/apis

## Deploy

### Docker

```bash
docker build -t settlegrid-chemspider .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -e CHEMSPIDER_API_KEY=xxx -p 3000:3000 settlegrid-chemspider
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
