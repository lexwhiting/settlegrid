# settlegrid-aml-data

AML/KYC Reference Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-aml-data)

Search AML/KYC compliance reference data via OpenSanctions. No API key needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_entities(query, schema?, limit?)` | Search AML reference entities | 2¢ |
| `get_entity(id)` | Get entity details | 2¢ |
| `list_datasets()` | List available AML datasets | 1¢ |

## Parameters

### search_entities
- `query` (string, required) — Name or keyword
- `schema` (string) — Entity type: Person, Organization, Company
- `limit` (number) — Max results (default 20)

### get_entity
- `id` (string, required) — Entity ID

### list_datasets

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream OpenSanctions API — it is completely free.

## Upstream API

- **Provider**: OpenSanctions
- **Base URL**: https://api.opensanctions.org
- **Auth**: None required
- **Docs**: https://api.opensanctions.org/

## Deploy

### Docker

```bash
docker build -t settlegrid-aml-data .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-aml-data
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
