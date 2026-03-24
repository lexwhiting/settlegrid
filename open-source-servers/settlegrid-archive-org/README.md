# settlegrid-archive-org

Archive.org Search MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-archive-org)

Search the Internet Archive for books, media, and web archives.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_archive(query, media_type?, limit?)` | Search Internet Archive | 1¢ |

## Parameters

### search_archive
- `query` (string, required) — Search term
- `media_type` (string) — Media type: texts, audio, movies, software
- `limit` (number) — Max results

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |

No API key needed for the upstream Internet Archive API — it is completely free.

## Upstream API

- **Provider**: Internet Archive
- **Base URL**: https://archive.org/advancedsearch.php
- **Auth**: None required
- **Docs**: https://archive.org/developers/

## Deploy

### Docker

```bash
docker build -t settlegrid-archive-org .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-archive-org
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
