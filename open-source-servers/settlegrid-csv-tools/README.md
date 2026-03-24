# settlegrid-csv-tools

CSV Tools MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-csv-tools)

Parse, convert, and analyze CSV data. No external API needed.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `parse(csv)` | Parse CSV into structured data | 1¢ |
| `to_json(csv)` | Convert CSV to JSON array | 1¢ |
| `analyze(csv)` | Statistical analysis of CSV columns | 2¢ |

## Parameters

### parse / to_json
- `csv` (string, required) — CSV string with headers

### analyze
- `csv` (string, required) — CSV string with headers

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

## Deploy

### Docker

```bash
docker build -t settlegrid-csv-tools .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-csv-tools
```

### Vercel

```bash
npm run build
vercel --prod
```

## License

MIT - see [LICENSE](LICENSE)

---

Built with [SettleGrid](https://settlegrid.ai) — The Settlement Layer for the AI Economy
