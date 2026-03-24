# settlegrid-genbank

GenBank Genomic Sequences MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-genbank)

Access NCBI GenBank genomic sequence data via E-utilities. Search nucleotide sequences, retrieve FASTA data, and get sequence summaries.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_sequences(query, limit?)` | Search nucleotide sequences by query | 1¢ |
| `get_sequence(id)` | Get FASTA sequence by accession/GI | 2¢ |
| `get_summary(id)` | Get sequence summary/metadata | 1¢ |

## Parameters

### search_sequences
- `query` (string, required) — Search query (e.g. "BRCA1 human", "COVID-19 spike")
- `limit` (number) — Max results (default 10, max 100)

### get_sequence
- `id` (string, required) — GenBank accession or GI number (e.g. NM_007294)

### get_summary
- `id` (string, required) — GenBank accession or GI number

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream NCBI E-utilities API — it is completely free.

## Upstream API

- **Provider**: NCBI E-utilities
- **Base URL**: https://eutils.ncbi.nlm.nih.gov/entrez/eutils
- **Auth**: None required
- **Docs**: https://www.ncbi.nlm.nih.gov/books/NBK25501/

## Deploy

### Docker

```bash
docker build -t settlegrid-genbank .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-genbank
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
