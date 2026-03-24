# settlegrid-hashnode

Hashnode MCP Server with per-call billing via [SettleGrid](https://settlegrid.ai).

[![Powered by SettleGrid](https://img.shields.io/badge/Powered%20by-SettleGrid-10B981?style=flat-square)](https://settlegrid.ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/settlegrid/settlegrid-hashnode)

Search and read Hashnode blog posts via GraphQL API with SettleGrid billing.

## Quick Start

```bash
npm install
cp .env.example .env   # Add your SettleGrid API key
npm run dev
```

## Methods

| Method | Description | Cost |
|--------|-------------|------|
| `search_posts(query, first)` | Search Hashnode posts | 1¢ |
| `get_publication(host)` | Get a Hashnode publication by host | 1¢ |

## Parameters

### search_posts
- `query` (string, required) — Search query
- `first` (number, optional) — Max results (1-20, default 10)

### get_publication
- `host` (string, required) — Publication host (e.g. "blog.example.com")

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SETTLEGRID_API_KEY` | Yes | Your SettleGrid API key from [settlegrid.ai](https://settlegrid.ai) |


## Upstream API

- **Provider**: Hashnode
- **Base URL**: https://gql.hashnode.com
- **Auth**: None required
- **Rate Limits**: Reasonable use
- **Docs**: https://apidocs.hashnode.com/

## Deploy

### Docker

```bash
docker build -t settlegrid-hashnode .
docker run -e SETTLEGRID_API_KEY=sg_live_xxx -p 3000:3000 settlegrid-hashnode
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
