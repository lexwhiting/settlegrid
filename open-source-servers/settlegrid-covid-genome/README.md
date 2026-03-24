# settlegrid-covid-genome

COVID Genomic Data MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-covid-genome)

Access COVID-19 genomic surveillance data via CoV-Spectrum LAPIS API. Get mutations, sequences, and variant prevalence.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `get_mutations(country?, lineage?)` | Get mutation data by country/lineage | 2¢ |
| `get_sequences(lineage, limit?)` | Get sequences by lineage | 2¢ |
| `get_prevalence(country, lineage?)` | Get variant prevalence by country | 1¢ |

## Parameters

### get_mutations
- `country` (string) — Country name (e.g. "USA", "Germany")
- `lineage` (string) — Pangolin lineage (e.g. BA.5, XBB.1.5)

### get_sequences
- `lineage` (string, required) — Pangolin lineage (e.g. BA.2)
- `limit` (number) — Max results (default 10)

### get_prevalence
- `country` (string, required) — Country name
- `lineage` (string) — Specific lineage to check

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream CoV-Spectrum LAPIS API API — it is completely free.

## Upstream API

- **Provider**: CoV-Spectrum LAPIS API
- **Base URL**: https://lapis.cov-spectrum.org/open/v2
- **Auth**: None required
- **Docs**: https://lapis.cov-spectrum.org/open/v2/docs

## Deploy

### Docker

```bash
docker build -t settlegrid-covid-genome .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-covid-genome
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
